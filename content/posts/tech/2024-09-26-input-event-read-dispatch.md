---
layout: post
title: "Android源码分析：系统进程中事件的读取与分发"
date: 2024-09-26T13:44:04+0800
tags: ["技术", "Android", "Android源码"]
keywords: ["Android", "Activity", "SourceCode", "OS", "InputEvent", "View"]
comments: true
feature: 
---

之前分析的是从InputChannel中读取Event，并且向后传递，进行消费和处理的过程。但是之前的部分呢，事件如何产生，事件怎么进入到InputChanel当中的，事件又是如何跨进程到达App进程，这里继续来分析。

![](https://img.isming.me/image/input_dispatch_flow.png)
<!--more-->

以上为system进程的流程的简化图，这里我们可以看到几个重要的组件，这里以触摸事件来进行分析（后文的分析也将会以触摸事件为主进行分析）并且简单的描绘了事件从EventHub到服务端的InputChannel发送事件的全部过程。具体内容一起来看下面的代码。


### InputManagerService的创建
因为事件的分发涉及到不少类，我们先从InputManagerService(IMS)的初始化出发，进行分析。入口代码在`SystemServer.java`中，代码如下：
```java
private void startOtherServices(@NonNull TimingsTraceAndSlog t) {
WindowManagerService wm = null;  
InputManagerService inputManager = null;
inputManager = new InputManagerService(context);
wm = WindowManagerService.main(context, inputManager, !mFirstBoot, mOnlyCore,  
        new PhoneWindowManager(), mActivityManagerService.mActivityTaskManager);  
ServiceManager.addService(Context.WINDOW_SERVICE, wm, /* allowIsolated= */ false,  
        DUMP_FLAG_PRIORITY_CRITICAL | DUMP_FLAG_PROTO);  
ServiceManager.addService(Context.INPUT_SERVICE, inputManager,  
        /* allowIsolated= */ false, DUMP_FLAG_PRIORITY_CRITICAL);

inputManager.setWindowManagerCallbacks(wm.getInputManagerCallback());  
inputManager.start();
}
```

这里我们可以看到WMS的创建我们传入了IMS，并且IMS也依赖`WindowMnagerCallbacks`，我们先看一下IMS的构造方法。
```java
public InputManagerService(Context context) {  
    this(new Injector(context, DisplayThread.get().getLooper()));  
}  
  
@VisibleForTesting  
InputManagerService(Injector injector) {  
    ... 
    mHandler = new InputManagerHandler(injector.getLooper());  
    mNative = injector.getNativeService(this);  
    ...
}
```

我们主要关注这个`mNative`的构建，它是`NativeImpl`，它的创建过程如下：
```java
new NativeInputManagerService.NativeImpl(service, mContext, mLooper.getQueue());
```

这里的Looper是前面传进来的`DisplayThread`的Looper。在`NativeImpl`的构造方法中调用了`init`方法，并获取到了它的native指针，这里需要看`com_android_server_input_InputManagerService.cpp`中的`natvieInit`方法，代码如下：
```c++
static jlong nativeInit(JNIEnv* env, jclass /* clazz */,  
        jobject serviceObj, jobject contextObj, jobject messageQueueObj) {  
    sp<MessageQueue> messageQueue = android_os_MessageQueue_getMessageQueue(env, messageQueueObj);  
    NativeInputManager* im = new NativeInputManager(contextObj, serviceObj,  
            messageQueue->getLooper());  
    im->incStrong(0);  
    return reinterpret_cast<jlong>(im);  
}
```

这里创建了`NativeInputManager`。
### NativeInputManager初始化
```c++
NativeInputManager::NativeInputManager(jobject contextObj,  
        jobject serviceObj, const sp<Looper>& looper) :  
        mLooper(looper), mInteractive(true) {  
    JNIEnv* env = jniEnv();  
  
    mServiceObj = env->NewGlobalRef(serviceObj);  
  
    {  
        AutoMutex _l(mLock);  
        mLocked.systemUiLightsOut = false;  
        mLocked.pointerSpeed = 0;  
        mLocked.pointerAcceleration = android::os::IInputConstants::DEFAULT_POINTER_ACCELERATION;  
        mLocked.pointerGesturesEnabled = true;  
        mLocked.showTouches = false;  
        mLocked.pointerDisplayId = ADISPLAY_ID_DEFAULT;  
    }  
    mInteractive = true;  
  
    InputManager* im = new InputManager(this, this);  
    mInputManager = im;  
    defaultServiceManager()->addService(String16("inputflinger"), im);  
}
```

这个构造方法中，传入的`jobject`为我们之前的`NativeImpl`，后面有需要调用java层的时候会用到它。除此之外我们看到又创建了一个InputManger，并且把它注册到了ServiceManger当中，名称为`inputflinger`。

我们继续看`InputManager`的初始化代码，它传如的两个参数`readerPolicy`和`dispatcherPolicy`的实现都在`NativeInputManager`当中。它的代码如下：
```c++
InputManager::InputManager(  
        const sp<InputReaderPolicyInterface>& readerPolicy,  
        const sp<InputDispatcherPolicyInterface>& dispatcherPolicy) {  
    mDispatcher = createInputDispatcher(dispatcherPolicy);  
    mClassifier = std::make_unique<InputClassifier>(*mDispatcher);  
    mBlocker = std::make_unique<UnwantedInteractionBlocker>(*mClassifier);  
    mReader = createInputReader(readerPolicy, *mBlocker);  
}
```

这里首先创建了`InputDispatcher`，之后创建的`mClassifier`、`mBlocker`和`InputDispatcher`一样都是继承自`InputListenerInterface`，它们的作用为在事件经过`InputDispatcher`分发之前，可以做一些预处理。最后创建`InputReader`，事件会经由它传递到`InputDispatcher`，最后再由`InputDispatcher`分到到`InputChannel`。下面来详细分析。


### 事件源的初始化
因为`InputDispatcher`初始化代码比较简单，我们从`createInputReader`的源码开始看起来：
```c++
std::unique_ptr<InputReaderInterface> createInputReader(  
        const sp<InputReaderPolicyInterface>& policy, InputListenerInterface& listener) {  
    return std::make_unique<InputReader>(std::make_unique<EventHub>(), policy, listener);  
}
```
我们可以看到在创建`InputReader`之前首先创建了一个`EventHub`，看名字我们就知道它是一个事件的收集中心。我们看它的构造方法，代码如下：
```c++
EventHub::EventHub(void)  
      : mBuiltInKeyboardId(NO_BUILT_IN_KEYBOARD),  
        mNextDeviceId(1),  
        ...
        mPendingINotify(false) {  
    ensureProcessCanBlockSuspend();  
  
    mEpollFd = epoll_create1(EPOLL_CLOEXEC);  //创建epoll实例，flag表示执行新的exec时候会自动关闭
  
    mINotifyFd = inotify_init1(IN_CLOEXEC);  //创建inotify实例，该实例用于监听文件的变化
  
    if (std::filesystem::exists(DEVICE_INPUT_PATH, errorCode)) {  
        addDeviceInputInotify();  
    } else {  
        addDeviceInotify();  
        isDeviceInotifyAdded = true;  
    
    }  
  
    struct epoll_event eventItem = {};  
    eventItem.events = EPOLLIN | EPOLLWAKEUP;  
    eventItem.data.fd = mINotifyFd;  
    int result = epoll_ctl(mEpollFd, EPOLL_CTL_ADD, mINotifyFd, &eventItem);  
    int wakeFds[2];  
    result = pipe2(wakeFds, O_CLOEXEC);  
    
    mWakeReadPipeFd = wakeFds[0];  
    mWakeWritePipeFd = wakeFds[1];  
  
    result = fcntl(mWakeReadPipeFd, F_SETFL, O_NONBLOCK);  
    
    result = fcntl(mWakeWritePipeFd, F_SETFL, O_NONBLOCK);  
    
    eventItem.data.fd = mWakeReadPipeFd;  
    result = epoll_ctl(mEpollFd, EPOLL_CTL_ADD, mWakeReadPipeFd, &eventItem);  
}
```

从上面的代码我们可以看到这里主要为创建inotify并且通过epoll去监听文件的变化，其中还是用管道创建了`wakeReadPipe`和`wakeReadPipe`的文件描述，用于接收回调。我们先看一下`addDeviceInputInotify()`方法:
```c++
void EventHub::addDeviceInputInotify() {  
    mDeviceInputWd = inotify_add_watch(mINotifyFd, DEVICE_INPUT_PATH, IN_DELETE | IN_CREATE);  
    
}
```
其中`DEVICE_INPUT_PATH`的值为`/dev/input`，也就是说把这个path放到`mINofiyFd`的监控当中。对于了解Linux的人应该知道，在Linux中万物结尾文件，因此我们的输入也是文件，当事件发生的时候便会写入到`/dev/input`下面，文件变化我们也会得到通知。我这里使用`ls`命令打印了一下我的手机，`/dev/input`下面有如下文件：
```bash
event0  event1  event2  event3  event4  event5
```

具体这些文件的写入，那就是内核和驱动相关的东西了，我们这里不再讨论。而事件的读取，我们后面再进行分析。


### IMS的启动
各个对象都构建完成之后，IMS要进行启动，才能够对事件进行处理并且分发。SystemServer中已经调用了IMS的`start`方法，它其中又会调用`NativeInputManger`的`start`方法，最终会调用 native层的`InputManager`的`start`方法。而其中分别又调用了`Dispatcher`的start方法和`Reader`的start方法。我们分别分析。
#### InputDispater 调用start
```c++
status_t InputDispatcher::start() {  
    if (mThread) {  
        return ALREADY_EXISTS;  
    }  
    mThread = std::make_unique<InputThread>(  
            "InputDispatcher", [this]() { dispatchOnce(); }, [this]() { mLooper->wake(); });  
    return OK;  
}
```

这个方法中主要创建了`InputThread`，并且给它传了两个lambda，分别执行`InputDispatch`的`dispatchOnce`方法和执行Looper的`wake`方法。我们看`InputThread`的构造方法：
```c++
InputThread::InputThread(std::string name, std::function<void()> loop, std::function<void()> wake)  
      : mName(name), mThreadWake(wake) {  
    mThread = new InputThreadImpl(loop);  
    mThread->run(mName.c_str(), ANDROID_PRIORITY_URGENT_DISPLAY);  
}
```

可以看到其中创建了`InputThreadImpl`，这个类才是真的继承的系统的`Thread`类，这里构建完成它就继续调用了它的`run`方法，这样它就会启动了。这里我们需要注意这个 线程的优先级，为`PRIORITY_URGEN_DISPLAY`,可以看到优先级是非常高了。
```c++
bool threadLoop() override {  
    mThreadLoop();  
    return true;  
}
```
另外就是我们传进来的`loop`传入了这个对象，并且在它的threadLoop中会执行它。对于native中的线程，我们在threadLoop中实现逻辑就可以了，并且这里我们返回值为`true`，它会继续循环执行 。而我们传入的另一个lambda，则是在线程推出的时候调用。这个线程循环中执行的就是我们的`InputDispatch`中 的`dispatchOnce`方法，也就是消息的投递，后面再来分析。

#### InputReader调用start方法
```c++
status_t InputReader::start() {  
    if (mThread) {  
        return ALREADY_EXISTS;  
    }  
    mThread = std::make_unique<InputThread>(  
            "InputReader", [this]() { loopOnce(); }, [this]() { mEventHub->wake(); });  
    return OK;  
}
```

这里的初始化，我们可以看到跟前面的`InputDispatch`很类似，连`InputThread`用的都是同一个类，内部也就一样有`InputThreadImpl`了。这里则是调用了`InputReader`内部的`loopOnce`方法。到这里系统就完成了输入事件分发的初始化了。

我们在看事件的分发之前，先看一下应用中的接收和系统的InputDispatch进行连接的过程。

### InputChannel的注册
我们之前分析[应用层的事件传递](https://isming.me/2024-09-20-activity-input-event-deliver/)的时候，只是谈到了`InputChannel`是在WMS调用如下代码生成的：
```java
mInputChannel = mWmService.mInputManager.createInputChannel(name); 
```

但是内部如何创建`InputChannel`的，以及 这个`InputChannel`是如何收到消息的我们都没有涉及，我们现在继续分析它一下。这个`createInputChannel`内部最终会调用到`native`层的`InputDispatcher`的`createInputChannel`方法， 代码如下：
```c++
Result<std::unique_ptr<InputChannel>> InputDispatcher::createInputChannel(const std::string& name) {  
    std::unique_ptr<InputChannel> serverChannel;  
    std::unique_ptr<InputChannel> clientChannel;  
    status_t result = InputChannel::openInputChannelPair(name, serverChannel, clientChannel);  
    ...
    { // acquire lock  
        std::scoped_lock _l(mLock);  
        const sp<IBinder>& token = serverChannel->getConnectionToken();  
        int fd = serverChannel->getFd();  
        sp<Connection> connection =  
                n1ew Connection(std::move(serverChannel), false /*monitor*/, mIdGenerator);  
        ...
        mConnectionsByToken.emplace(token, connection);  
  
        std::function<int(int events)> callback = std::bind(&InputDispatcher::handleReceiveCallback, this, std::placeholders::_1, token);  
  
        mLooper->addFd(fd, 0, ALOOPER_EVENT_INPUT, new LooperEventCallback(callback), nullptr);  
    } // release lock  
  
    // Wake the looper because some connections have changed.    
    mLooper->wake();  
    return clientChannel;  
}
```
首先是第4行代码，这里创建了InputChannel，而它又分为`serverChannel`和`clientChannel`，返回调用方的是`clientChannel。

我们先进去看看其源码：
```c++
status_t InputChannel::openInputChannelPair(const std::string& name,  
                                            std::unique_ptr<InputChannel>& outServerChannel,  
                                            std::unique_ptr<InputChannel>& outClientChannel) {  
    int sockets[2];  
    if (socketpair(AF_UNIX, SOCK_SEQPACKET, 0, sockets)) {  //创建socket对
	    ..
        return result;  
    }  
    ..
    sp<IBinder> token = new BBinder();  
  
    std::string serverChannelName = name + " (server)";  
    android::base::unique_fd serverFd(sockets[0]);  //获取server socket fd
    outServerChannel = InputChannel::create(serverChannelName, std::move(serverFd), token);  //创建server InputChannel
  
    std::string clientChannelName = name + " (client)";  
    android::base::unique_fd clientFd(sockets[1]);  
    outClientChannel = InputChannel::create(clientChannelName, std::move(clientFd), token);  //创建Client InputChannel
    return OK;  
}
```

以上代码我们可以看到就是创建了一对socket，分别放到两个InputChannel当中，并且这里创建了一个`BBinder`作为两个InputChannel的token，具体用处我们后面会再提到。此时可以继续回看前面的`createInputChannel`方法，在11行，创建了一个 `Connection`对象，并且以前面创建的`BBinder`为key放到了`mConnectionsByToken`当中，`Connection`的用处留到后面继续讲。

在15行创建了一个callback，其中会执行`InputDispatcher`的`handleReceiveCallback`方法，并且这个callback被添加looper的`addFd`的时候设置进去了，这里的fd就是之前创建的ServerInputChannel的socket的文件描述符。到这里就完成了初始化，添加了服务端InputChannel的文件描述符监听。

### 事件触发

我们之前在分析InputManger的启动的时候，已经看到了事件是通过`/dev/input`来通知到`EventHub`，而`InputReader`通过Looper监听了`/dev/input`的文件描述符，从而让我们事件传递的系统动起来。那么我们首先就从`InputReader`的`loopOnce`开始看起来。
```c++
void InputReader::loopOnce() {  
	...
    size_t count = mEventHub->getEvents(timeoutMillis, mEventBuffer, EVENT_BUFFER_SIZE);  
  
    { // acquire lock  
        std::scoped_lock _l(mLock);  
        mReaderIsAliveCondition.notify_all();  
  
        if (count) {  
            processEventsLocked(mEventBuffer, count);  
        }  
        ...
    } // release lock  
    ...
    mQueuedListener.flush();  
}
```
我们这里省略了设备变化，超时等相关的代码，仅仅保留了事件读取相关的部分。我们看到，首先在第3行中，从`EventHub`中去获取新的事件，之后在第10行，去处理这些事件，第15行会清楚所有的事件，我们分别看看各个里面的逻辑。

#### 从EventHub读取事件
首先是`getEvents`方法：

```c++
size_t EventHub::getEvents(int timeoutMillis, RawEvent* buffer, size_t bufferSize) {  
    std::scoped_lock _l(mLock);  
    struct input_event readBuffer[bufferSize];  
    RawEvent* event = buffer;  
    size_t capacity = bufferSize;  
    bool awoken = false;  
    for (;;) {  
        nsecs_t now = systemTime(SYSTEM_TIME_MONOTONIC);  

        bool deviceChanged = false;  
        //pendingIndex小于PendingCount，说明之前有事件还为处理完
        while (mPendingEventIndex < mPendingEventCount) {  
            const struct epoll_event& eventItem = mPendingEventItems[mPendingEventIndex++];  
            ...
            Device* device = getDeviceByFdLocked(eventItem.data.fd);  
            if (device == nullptr) {  //未能找到device，报错跳出
                continue;  
            }  
            
            // EPOLLIN表示有事件可以处理
            if (eventItem.events & EPOLLIN) {  
                int32_t readSize =  
                        read(device->fd, readBuffer, sizeof(struct input_event) * capacity);  
                if (readSize == 0 || (readSize < 0 && errno == ENODEV)) {  
                    // 接收到通知之前，设备以及不见了
                    deviceChanged = true;  
                    closeDeviceLocked(*device);  
                } else if() { //其中的错误情况，忽略掉
                } else {  
                    int32_t deviceId = device->id == mBuiltInKeyboardId ? 0 : device->id;  
  
                    size_t count = size_t(readSize) / sizeof(struct input_event);  //根据一个事件的大小，来算同一个设备上面读取到的事件的个数
                    //以下为具体保存事件到event当中
                    for (size_t i = 0; i < count; i++) {  
                        struct input_event& iev = readBuffer[i];  
                        event->when = processEventTimestamp(iev);  
                        event->readTime = systemTime(SYSTEM_TIME_MONOTONIC);  
                        event->deviceId = deviceId;  
                        event->type = iev.type;  
                        event->code = iev.code;  
                        event->value = iev.value;  
                        event += 1;  
                        capacity -= 1;  
                    }  
                    if (capacity == 0) {  //缓冲区已经满了，无法在记录事件，跳出
                        mPendingEventIndex -= 1;  
                        break;  
                    }  
                }  
            } else if (eventItem.events & EPOLLHUP) {  
               ... 
            } else {  
	            ...
            }  
        }  
        ...
        //event和buffer地址不同说明已经拿到事件了，可以跳出循环 
        if (event != buffer || awoken) {  
            break;  
        }  

        mPendingEventIndex = 0;  
        mLock.unlock(); // poll之前先加锁
        int pollResult = epoll_wait(mEpollFd, mPendingEventItems, EPOLL_MAX_EVENTS, timeoutMillis);  
        mLock.lock(); // poll完之后从新加锁
  
        if (pollResult == 0) {  
            // Timed out.  
            mPendingEventCount = 0;  
            break;  
        }  
  
        if (pollResult < 0) {  
            mPendingEventCount = 0;  
            if (errno != EINTR) {  
                usleep(100000);  
            }  
        } else {  
            mPendingEventCount = size_t(pollResult);  
        }  
    }  
  
    // event为填充之后的指针地址，而buffer为开始的地址，相减获得count
    return event - buffer;  
}
```

这个方法是很复杂的，但是我们主要分析事件的分发，因此其中关于设备变化，设备响应，错误处理等等相关的代码都省略了。这个方法，我们传入了一个`RawEvent`的指针用来接收事件，另外传了`bufferSize`来表示我们所能接收的事件数量。这个方法使用了两层循环来进行逻辑的处理，外层的为无限循环。当我们第一次进入这个方法当中，`mPendingEventCount`和`mPendingEventIndex`都是0，因此不会进入第二层的循环，这个时候会执行到64行，调用`epoll_wait`系统调用，去读取事件，读取的结果会放到`mPendingEventItems`当中，之后会算出`pendingCount`。这样继续循环，我们就可以进入内存循环当中了。
在刚刚的`PendingEventItem`中并没有存储具体的事件，而是存储的事件发生的设备文件描述符，在内存的循环中，首先会根据设备的描述符查找设备，并对其进行检查。之后再从设备当中读取事件，拼装成为需要向后分发的事件。
这里的count有点让人迷糊，我画了个图如下所示：
![](https://img.isming.me/image/event_hub_read.png)

其中我们真正读取的事件的数量，是要看有几个设备，每个设备有多少个事件，对其进行计算。
到这里我们就获取到了事件，这里可以回到`InputReader`中继续往下看了。

#### InputReader对事件进行处理
在这里的处理调用的是`processEventsLocked`，代码如下：
```c++
void InputReader::processEventsLocked(const RawEvent* rawEvents, size_t count) {  
    for (const RawEvent* rawEvent = rawEvents; count;) {  
        int32_t type = rawEvent->type;  
        size_t batchSize = 1;  
        //如果不是设备处理相关的事件，则执行。
        if (type < EventHubInterface::FIRST_SYNTHETIC_EVENT) {  
            int32_t deviceId = rawEvent->deviceId;  
            while (batchSize < count) {   
                if (rawEvent[batchSize].type >= EventHubInterface::FIRST_SYNTHETIC_EVENT ||  
                    rawEvent[batchSize].deviceId != deviceId) {  
                    //当遇到设备整删除事件，或者不是当前设备的事件，就不能进行批量处理，跳过。
                    break;  
                }  
                batchSize += 1;  
            }  
            processEventsForDeviceLocked(deviceId, rawEvent, batchSize);  
        } else {  
            //设备添加删除之类的事件处理，跳过
        }  
        count -= batchSize;  
        rawEvent += batchSize;  
    }  
}
```

这个方法中主要是对与设备增加删除事件和普通事件进行分别处理，如果是普通的事件，会对同一个设备上的事件进行批量处理，批量处理则会调用`processEventsForDeviceLocked`方法：
```c++
void InputReader::processEventsForDeviceLocked(int32_t eventHubId, const RawEvent* rawEvents,  
                                               size_t count) {  
    auto deviceIt = mDevices.find(eventHubId);  
    if (deviceIt == mDevices.end()) {  
        //没有找到设备，返回
        return;  
    }  
  
    std::shared_ptr<InputDevice>& device = deviceIt->second;  
    if (device->isIgnored()) {  //是被忽略的设备，跳过
        return;  
    }  
  
    device->process(rawEvents, count);  
}
```

这个方法中主要是查找设备，找到未忽略的设备则会调用设备的`process`方法进行处理。
`InputDevice`只是设备的抽象，而其中的处理又会调用`InputMapper`的方法，`InputMapper`是抽象类，它有许多的实现，比如我们的触摸事件就会有`TouchuInputMapper`、`MultiTouchInputMapper`，各种不同的`InputMapper`会对事件进行处理，拼装成符合相关类型的事件，其中逻辑我们就不继续进行追踪了。

对于touch事件，这个process处理完成，在`TouchInputMapper`中最终会调用`dispatchMotion`，这个方法代码如下：
```c++
void TouchInputMapper::dispatchMotion(...) {  
    PointerCoords pointerCoords[MAX_POINTERS];  
    PointerProperties pointerProperties[MAX_POINTERS];  
    uint32_t pointerCount = 0;  
    ...
    const int32_t displayId = getAssociatedDisplayId().value_or(ADISPLAY_ID_NONE);  
    const int32_t deviceId = getDeviceId();  
    std::vector<TouchVideoFrame> frames = getDeviceContext().getVideoFrames();  
    std::for_each(frames.begin(), frames.end(),  
                  [this](TouchVideoFrame& frame) { frame.rotate(this->mInputDeviceOrientation); });  
    NotifyMotionArgs args(getContext()->getNextId(), when, readTime, deviceId, source, displayId,  
                          policyFlags, action, actionButton, flags, metaState, buttonState,  
                          MotionClassification::NONE, edgeFlags, pointerCount, pointerProperties,  
                          pointerCoords, xPrecision, yPrecision, xCursorPosition, yCursorPosition,  
                          downTime, std::move(frames));  
    getListener().notifyMotion(&args);  
}
```
其中有许多关于多点触控，事件处理的判断，这里只关注最后的部分，就是将事件组装成一个`NotifyMotionArgs`对象，并调用`Listener`的`notifyMotion`方法。这里的`getListener()`内部首先会调用`getContenxt`获取Context，而这个Context就是`InputReader`的内部成员`mContext`，这这个`Listener`也就是我们之前在初始化`InputReader`时候它的成员变量`mQueuedListener`，那我们下面继续去看它的`notifyMotion`。

#### notifyMotion
```c++
void QueuedInputListener::notifyMotion(const NotifyMotionArgs* args) {  
    traceEvent(__func__, args->id);  
    mArgsQueue.emplace_back(std::make_unique<NotifyMotionArgs>(*args));  
}
```
这里是直接把之前的那个变量放到`mArgsQueue`当中了。这个时候，我们需要留意一下之前`InputReade`的`loopOnce`的15行，这里调用的 `flush`方法，也是这个`QueuedInputListener`内部的：
```c++
void QueuedInputListener::flush() {  
    for (const std::unique_ptr<NotifyArgs>& args : mArgsQueue) {  
        args->notify(mInnerListener);  
    }  
    mArgsQueue.clear();  
}
```
这里这是掉用了我们传进来的`NotifyArgs`的notify方法，并且传过来的参数`mInnerListener`是我们之前创建`InputManager`时候创建的，这里会有三层嵌套，首先是`UnWantedInteractionBlocker`先处理，之后它会按情况传递给`InputClassifier`处理，最后是在`InputDispatcher`当中处理。

我们先看看看`notify`当中做了什么，再继续往后看。
```c++
void NotifyMotionArgs::notify(InputListenerInterface& listener) const {  
    listener.notifyMotion(this);  
}
```

这里也是比较简单，就是直接调用了linster的`notifyMotion`方法，我们可以直接去看了。因为我们主要关注 传递，而不关注处理，这里就跳过，直接看`InputDispatcher`中的这个方法。
```c++
void InputDispatcher::notifyMotion(const NotifyMotionArgs* args) {    
    if (!validateMotionEvent(args->action, args->actionButton, args->pointerCount,  
                             args->pointerProperties)) {  
        return;  //不合法的触摸事件直接返回 
    }  
  
    uint32_t policyFlags = args->policyFlags;  
    policyFlags |= POLICY_FLAG_TRUSTED;  
  
    android::base::Timer t;  
   
    bool needWake = false;  
    { // acquire lock  
        mLock.lock();  
        ...
        std::unique_ptr<MotionEntry> newEntry =  
                std::make_unique<MotionEntry>(args->id, args->eventTime, args->deviceId,  
                                              args->source, args->displayId, policyFlags,  
                                              args->action, args->actionButton, args->flags,  
                                              args->metaState, args->buttonState,  
                                              args->classification, args->edgeFlags,  
                                              args->xPrecision, args->yPrecision,  
                                              args->xCursorPosition, args->yCursorPosition,  
                                              args->downTime, args->pointerCount,  
                                              args->pointerProperties, args->pointerCoords);  
        ...
        needWake = enqueueInboundEventLocked(std::move(newEntry));  
        mLock.unlock();  
    } // release lock  
  
    if (needWake) {  
        mLooper->wake();  
    }  
}
```
在这里则是执行完一些检查之后，把事件封装成为`MotionEntry`，调用`enqueueInboundEventLocked`，最后调用`looper`的`wake`方法。`enqueueInboundEventLocked`代码如下：
```c++
bool InputDispatcher::enqueueInboundEventLocked(std::unique_ptr<EventEntry> newEntry) {  
    bool needWake = mInboundQueue.empty();  
    mInboundQueue.push_back(std::move(newEntry));  
    EventEntry& entry = *(mInboundQueue.back());  
    switch (entry.type) {  
        case EventEntry::Type::MOTION: {  
            if (shouldPruneInboundQueueLocked(static_cast<MotionEntry&>(entry))) {   //返回true的时候，事件会被移除不处理
                mNextUnblockedEvent = mInboundQueue.back();  
                needWake = true;  
            }  
            break;  
        }  
        ...
    }  
  
    return needWake;  
}
```

在这里，首先把事件放入`mInboundQueue`这个`deque`当中，最后根据事件的类型和信息要不要唤醒looper，如果事件不被移除needWake就为false，前面的wake也不会被调用。但是这个是否调用，不影响我们的后续分析，因为`InputDispatch`中的Thead会一直循环调用。

### InputDispatcher分发消息
说到这里，我们就该来看看`InputDispatcher`的`dispatchOnce`方法了：
```c++
void InputDispatcher::dispatchOnce() {  
    nsecs_t nextWakeupTime = LONG_LONG_MAX;  
    { // acquire lock  
        std::scoped_lock _l(mLock);  
        mDispatcherIsAlive.notify_all();  
  
        if (!haveCommandsLocked()) {  
            dispatchOnceInnerLocked(&nextWakeupTime);  
        }  
  
        if (runCommandsLockedInterruptable()) {  
            nextWakeupTime = LONG_LONG_MIN;  
        }  
        ...
    } // release lock  
  
    //等待下一次调用
    mLooper->pollOnce(timeoutMillis);  
}
```

这里有不少处理下一次唤醒的逻辑，我们都跳过，主要就看一下第8行，进行这一次的实际执行内容：
```c++
void InputDispatcher::dispatchOnceInnerLocked(nsecs_t* nextWakeupTime) {  
	...
    if (!mPendingEvent) {  //当前没有待处理的pending事件
        if (mInboundQueue.empty()) {  //如果事件列表为空
            ... 
            if (!mPendingEvent) {  
                return;  
            }  
        } else {  
            // 列表中拿一个事件
            mPendingEvent = mInboundQueue.front();  
            mInboundQueue.pop_front();  
            traceInboundQueueLengthLocked();  
        }  
        ...
    }  
  
    bool done = false;  
    ..
    switch (mPendingEvent->type) {  
		...
        case EventEntry::Type::MOTION: {  
            std::shared_ptr<MotionEntry> motionEntry =  
                    std::static_pointer_cast<MotionEntry>(mPendingEvent);  
            ...
            done = dispatchMotionLocked(currentTime, motionEntry, &dropReason, nextWakeupTime);  
            break;  
        }  
        ...
    }  
  
    if (done) {  
        ...
        releasePendingEventLocked();  
        *nextWakeupTime = LONG_LONG_MIN; // force next poll to wake up immediately  
    }  
}
```

我们将这个方法进行了简化，仅仅保留了触摸事件的部分代码。首先判断`mPendingEvent`是否为空，为空的时候我们需要到`mPendingEvent`中去拿一个，我们之前插入的是尾部，这里是从头部取的。拿到事件进行完种种处理和判断之后，会调用`dispatchMotionLocked`进行触摸事件的分发：
```c++
bool InputDispatcher::dispatchMotionLocked(nsecs_t currentTime, std::shared_ptr<MotionEntry> entry,  
                                           DropReason* dropReason, nsecs_t* nextWakeupTime) {  
    if (!entry->dispatchInProgress) {   //设置事件正在处理中
        entry->dispatchInProgress = true;  

    }  
  
    if (*dropReason != DropReason::NOT_DROPPED) {  
        //对于要抛弃的事件这里进行处理，返回
        return true;  
    }  
  
    const bool isPointerEvent = isFromSource(entry->source, AINPUT_SOURCE_CLASS_POINTER);  //读取是否为POINTER
    std::vector<InputTarget> inputTargets;  
  
    bool conflictingPointerActions = false;  
    InputEventInjectionResult injectionResult;  
    if (isPointerEvent) {  
	    //如果屏幕触摸事件则去找到对应的window
        injectionResult =  
                findTouchedWindowTargetsLocked(currentTime, *entry, inputTargets, nextWakeupTime,  
                                               &conflictingPointerActions);  
    } else {  
        // Non touch event.  (eg. trackball)  
        injectionResult =  
                findFocusedWindowTargetsLocked(currentTime, *entry, inputTargets, nextWakeupTime);  
    }  
    if (injectionResult == InputEventInjectionResult::PENDING) {  
        return false;  
    }  
  
    setInjectionResult(*entry, injectionResult);  
    ...
  
    // Dispatch the motion.  
    dispatchEventLocked(currentTime, entry, inputTargets);  
    return true;  
}
```
这个方法中依然是对于事件做很多的处理和判断，比如否要抛弃等。但是其中最终要的是调用`findFocusedWIndowTargetsLocked`来找到我们的事件所对应的Window，并且保存相关信息到`inputTargets`当中，这里获取`inputTargets`的过程比较复杂，但是简单来说呢就是从之前我们保存在`InputDispatcher`中的`mConnectionsByToken`中查找到对应的条目，这里暂不深入分析。拿到这个之后就是调用`dispatchEventLocked`去分发，代码如下：
```c++
void InputDispatcher::dispatchEventLocked(nsecs_t currentTime,  
                                          std::shared_ptr<EventEntry> eventEntry,  
                                          const std::vector<InputTarget>& inputTargets) {  
    ...
    for (const InputTarget& inputTarget : inputTargets) {  
        sp<Connection> connection =  
                getConnectionLocked(inputTarget.inputChannel->getConnectionToken());  
        if (connection != nullptr) {  
            prepareDispatchCycleLocked(currentTime, connection, eventEntry, inputTarget);  
        } else {  
            
        }  
    }  
}
```

通过这里我们可以看到首先是通过`inputTarget`去拿到`connectionToken`，再通过它拿到`Connection`。最后通过调用`prepareDispatchCycleLocked`。
```c++
void InputDispatcher::prepareDispatchCycleLocked(nsecs_t currentTime,  
                                                 const sp<Connection>& connection,  
                                                 std::shared_ptr<EventEntry> eventEntry,  
                                                 const InputTarget& inputTarget) {  
    ...
    enqueueDispatchEntriesLocked(currentTime, connection, eventEntry, inputTarget);  
}
```
这个方法简化的化，这是调用第6行的这个方法，代码如下：
```c++
void InputDispatcher::enqueueDispatchEntriesLocked(nsecs_t currentTime,  
                                                   const sp<Connection>& connection,  
                                                   std::shared_ptr<EventEntry> eventEntry,  
                                                   const InputTarget& inputTarget) {  
  
    bool wasEmpty = connection->outboundQueue.empty();  
  
    // Enqueue dispatch entries for the requested modes.  
    enqueueDispatchEntryLocked(connection, eventEntry, inputTarget,  
                               InputTarget::FLAG_DISPATCH_AS_HOVER_EXIT);  
    enqueueDispatchEntryLocked(connection, eventEntry, inputTarget,  
                               InputTarget::FLAG_DISPATCH_AS_OUTSIDE);  
    enqueueDispatchEntryLocked(connection, eventEntry, inputTarget,  
                               InputTarget::FLAG_DISPATCH_AS_HOVER_ENTER);  
    enqueueDispatchEntryLocked(connection, eventEntry, inputTarget,  
                               InputTarget::FLAG_DISPATCH_AS_IS);  
    enqueueDispatchEntryLocked(connection, eventEntry, inputTarget,  
                               InputTarget::FLAG_DISPATCH_AS_SLIPPERY_EXIT);  
    enqueueDispatchEntryLocked(connection, eventEntry, inputTarget,  
                               InputTarget::FLAG_DISPATCH_AS_SLIPPERY_ENTER);  
  
    // If the outbound queue was previously empty, start the dispatch cycle going.  
    if (wasEmpty && !connection->outboundQueue.empty()) {  
        startDispatchCycleLocked(currentTime, connection);  
    }  
}
```

其中对于消息会尝试按照每一种mode都调用`enqueueDIspatchEntryLocked`方法，代码如下：
```c++
void InputDispatcher::enqueueDispatchEntryLocked(const sp<Connection>& connection,  
                                                 std::shared_ptr<EventEntry> eventEntry,  
                                                 const InputTarget& inputTarget,  
                                                 int32_t dispatchMode) {  
    
    int32_t inputTargetFlags = inputTarget.flags;  
    if (!(inputTargetFlags & dispatchMode)) {  
        return;  
    }  
    inputTargetFlags = (inputTargetFlags & ~InputTarget::FLAG_DISPATCH_MASK) | dispatchMode;  
  
    std::unique_ptr<DispatchEntry> dispatchEntry =  
            createDispatchEntry(inputTarget, eventEntry, inputTargetFlags);  
  
    EventEntry& newEntry = *(dispatchEntry->eventEntry);  
    // Apply target flags and update the connection's input state.  
    switch (newEntry.type) {  
        case EventEntry::Type::MOTION: {  
            const MotionEntry& motionEntry = static_cast<const MotionEntry&>(newEntry);  
            constexpr int32_t DEFAULT_RESOLVED_EVENT_ID =  
                    static_cast<int32_t>(IdGenerator::Source::OTHER);  
            dispatchEntry->resolvedEventId = DEFAULT_RESOLVED_EVENT_ID;  
            ...
            
            
            if ((motionEntry.flags & AMOTION_EVENT_FLAG_NO_FOCUS_CHANGE) &&  
                (motionEntry.policyFlags & POLICY_FLAG_TRUSTED)) {  
                break;  
            }  
  
            dispatchPointerDownOutsideFocus(motionEntry.source, dispatchEntry->resolvedAction,  
                                            inputTarget.inputChannel->getConnectionToken());  
            break;  
        }  
        ...
    }  
    connection->outboundQueue.push_back(dispatchEntry.release());  
    traceOutboundQueueLength(*connection);  
}
```
在这个方法中，又把事件封装成为`dispatchEntry`，并放到Connection内部的`outboundQueue`这个队列当中。

到这里我们可以回看上面的`enqueueDispatchEntriesLocked`的最后一块代码，那里有判断了如果这个`outboundQueue`队列不为空，则会执行最后的`startDispatchCycleLocked`,代码如下：
```c++
void InputDispatcher::startDispatchCycleLocked(nsecs_t currentTime,  
                                               const sp<Connection>& connection) {  
    
    while (connection->status == Connection::Status::NORMAL && !connection->outboundQueue.empty()) {  
        DispatchEntry* dispatchEntry = connection->outboundQueue.front();  
        dispatchEntry->deliveryTime = currentTime;  
        ...
        // Publish the event.  
        status_t status;  
        const EventEntry& eventEntry = *(dispatchEntry->eventEntry);  
        switch (eventEntry.type) {   
            ...
            case EventEntry::Type::MOTION: {  
                const MotionEntry& motionEntry = static_cast<const MotionEntry&>(eventEntry);  
                ... 
  
                std::array<uint8_t, 32> hmac = getSignature(motionEntry, *dispatchEntry);  
  
                status = connection->inputPublisher  
                                 .publishMotionEvent(dispatchEntry->seq,  
                                                     dispatchEntry->resolvedEventId,  
                                                     motionEntry.deviceId, motionEntry.source,  
                                                     motionEntry.displayId, std::move(hmac),  
                                                     dispatchEntry->resolvedAction,  
                                                     motionEntry.actionButton,  
                                                     dispatchEntry->resolvedFlags,  
                                                     motionEntry.edgeFlags, motionEntry.metaState,  
                                                     motionEntry.buttonState,  
                                                     motionEntry.classification,  
                                                     dispatchEntry->transform,  
                                                     motionEntry.xPrecision, motionEntry.yPrecision,  
                                                     motionEntry.xCursorPosition,  
                                                     motionEntry.yCursorPosition,  
                                                     dispatchEntry->rawTransform,  
                                                     motionEntry.downTime, motionEntry.eventTime,  
                                                     motionEntry.pointerCount,  
                                                     motionEntry.pointerProperties, usingCoords);  
                break;  
            }  
        }  
        ... 
        
    }  
}
```

在这个方法中，则是从`outboundQueue`把所有的事件一条一条的取出来，解包成它要的类型，比如触摸事件就是`MotionEntry`，经过判断和一些处理之后，调用`connection`中的`inputPublisher`的`publishMotionEvent`方法，这里的`inputPublisher`我们之前分析创建`InputChannel`的时候有所了解，创建它所传的InputChannel为Server端的那个。
我们这里看一下它的`publishMotionEvent`方法：
```c++
status_t InputPublisher::publishMotionEvent(...) {  
    
    InputMessage msg;  
    msg.header.type = InputMessage::Type::MOTION;  
    msg.header.seq = seq;  
    msg.body.motion.eventId = eventId;  
    ...
    msg.body.motion.pointerCount = pointerCount;  
    for (uint32_t i = 0; i < pointerCount; i++) {  
        msg.body.motion.pointers[i].properties.copyFrom(pointerProperties[i]);  
        msg.body.motion.pointers[i].coords.copyFrom(pointerCoords[i]);  
    }  
  
    return mChannel->sendMessage(&msg);  
}
```

这里主要创建了`InputMessage`，将之前`MotionEvent`的所有参数放进去，通过`ServerInputChannel`调用`sendMessage`发送出去，`sendMessage`的代码如下：
```c++
status_t InputChannel::sendMessage(const InputMessage* msg) {  
    const size_t msgLength = msg->size();  
    InputMessage cleanMsg;  
    msg->getSanitizedCopy(&cleanMsg);  
    ssize_t nWrite;  
    do {  
        nWrite = ::send(getFd(), &cleanMsg, msgLength, MSG_DONTWAIT | MSG_NOSIGNAL);  
    } while (nWrite == -1 && errno == EINTR);  

    return OK;  
}
```

我们知道，`InputChannel`内部的文件描述符为`socket`的标记，这里调用send方法，也就是通过socket把信息发送出去，这样的话，我们`Client`端的的socket也就会接收到，通过Looper，Client端的EventListener就可以接收到消息，我们的应用便可以接收到，到这里便把事件分发，完整的串起来了。

### 总结
以上就是事件在系统进程中的处理，包括它的事件获取，事件处理，最后通过socket发送，这样我们在客户端进程的`InputChannel`就能够接收到通知，客户端能够处理事件。配合我们之前分析过[应用层的事件分发](https://isming.me/2024-09-20-activity-input-event-deliver/),到这里，不算事件的驱动相关的部分，事件分发的整个流程我们都有所了解了。

在这里事件从系统system_server通过Server的InputChannel发送的客户端的InputChannel，所采用的是unix的socket功能，而不是使用的binder或者其他的跨进程服务。这一块，结合我在网上查找的资料，以及我自己的想法，我想这里这样做的原因是，unix的sockt pair使用上很简单，并且运行效率很高效，不需要像binder一样涉及到进程和线程的切换。另外就是socket使用了fd，目标进程可以直接监听到事件的来临，而不是向binder一样需要有相应的接口涉及，可以更加实时的接收到事件，也不会因为binder线程阻塞而卡顿。

当然这是我的一些想法，也欢迎读者朋友说说你对于这块的想法。