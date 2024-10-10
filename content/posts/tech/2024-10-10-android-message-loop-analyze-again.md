---
layout: post
title: "Android源码分析：再读消息循环源码"
date: 2024-10-10T21:17:16+0800
tags: ["技术", "Android", "Android源码"]
keywords: ["Android", "Framework", "SourceCode", "OS", "Looper", "Message"]
comments: true
feature: 
---

Android消息循环在应用开发中会经常涉及，我以前也分析过。不过那个时候分析的还是以很老的Android源码来进行的，并且只是分析了Java层的代码，当时的文章为：[Android消息循环分析](https://isming.me/2014-04-02-android-message-loop-analyze/)。而Native层，以及一些新增的功能，都没有涉及，今天再读源码，对其进行再次分析。

![消息循环简化版本](https://img.isming.me/image/message-loop-basic.png)
<!--more-->

对于应用层的开发者来说，虽然已经过了10年，java层的Api还是跟之前一样的，依然是通过`Handler`发送消息，Looper会中消息队列中取消息，消息会根据Handler中的callback或者消息自己的callback执，如上图所示。我之前分析的发送消息和处理消息已经比较清楚了，这块不再看了。这里主要分析一下从MessageQueue取消息，之前涉及的文件描述符的监控和Native层的一些实现等进行分析。

### java层loop取消息
首先来看java层如何从消息队列取消息的，`Looper`中有如下代码：
```java
public static void loop() {  
    final Looper me = myLooper();  
    ...
    me.mInLoop = true;  
	Binder.clearCallingIdentity();  
    final long ident = Binder.clearCallingIdentity();  
    ...
    for (;;) {  
        if (!loopOnce(me, ident, thresholdOverride)) {  
            return;  
        }  
    }  
}
```
以上代码核心就是拿到当前线程的Looper然后，在无限循环当中取调用`loopOnce`。`loopOnce`代码很长，但是忽略错误处理和Log，核心代码如下：
```java
private static boolean loopOnce(final Looper me,  
        final long ident, final int thresholdOverride) {  
    Message msg = me.mQueue.next(); //从消息队列中取消息
    ...
    msg.target.dispatchMessage(msg); //分发消息
    ...
    msg.recycleUnchecked(); //回收消息，方便下一次发送消息使用
    return true;
}
```

在`loopOnce`中主要就是去通过`MessageQueue`取消息，之后在分发消息，并且回收消息。再来看`MessageQueue`的`next`方法：
```java
Message next() {
	final long ptr = mPtr;
	...
	int nextPollTimeoutMillis = 0;
	for (;;) {
		nativePollOnce(ptr, nextPollTimeoutMillis);
		synchronized (this) {
			Message prevMsg = null;  
			Message msg = mMessages;  
			if (msg != null && msg.target == null) {  
			    do {  
			        prevMsg = msg;  
			        msg = msg.next;  
				} while (msg != null && !msg.isAsynchronous());  
			} 
			if (msg != null) {
				if (now < msg.when) {
					nextPollTimeoutMillis = (int) Math.min(msg.when - now, Integer.MAX_VALUE);
				} else {
					mBlock = false;
					if (preMsg != null) {
						prevMsg.next = msg.next;
					} else {
						mMessages = msg.next;
					}
					msg.next = null;
					msg.markInUse();
					return msg;
				}
			} else {
				nextPollTimeoutMillis = -1;
			}
			...
		}
		...
	}
}
```

以上为`next`方法的简化，在Java层的MessageQueue的实现就是一个链表，因此向其中发送消息或者取消息的过程就是链表添加或者删除的过程。在第21行到第26行就是从链表中删除msg的过程。其中这个链表它的头节点是存放在`mMessages`这个变量，Message在插入链表的时候，也是按照事件先后运行放到链表当中的。

在这个方法的开头，我们看到`mPtr`，它就是MessageQueue在native层对应的对象，不过Native的Message和Java层的Message是相互独立的，在读取next的时候，也会通过`nativePollOnce`来native层来读取一个消息，另外在这里还传了一个`nextPollTimeoutMillis`，用来告诉native需要等待的时间，具体后面在来具体分析相关代码。

因为我们的消息循环中除了放置我们通过`Handler`所发送的消息之外，还会存在同步信号的屏障，比如`ViewRootImpl`就会在每一次`scheduleTraversals`的时候发送一个屏障消息。屏障消息和普通消息的区别就是没有`target`Handler。因此在第10行，当我们检查到是屏障消息的时候，会跳过它， 并且查找它之后的第一条异步消息。
另外就是在这个do-while的循环条件中，我们可以看到它还有判断消息是否为`Asynchronous`的，我们正常创建的Handler一般`async`都是false，也就是说消息的这个值也是为false。而异步的，一般会被IMS，WMS，Display，动画等系统组件使用，应用开发者无法使用。

这里我们只要知道，如果有异步消息，就会先执行异步消息。在第17行，这里还会判断消息的事件，如果消息的`when`比当前事件大的化，那么这个消息还不能够执行，这时候需要去等待，这里就会给`nextPollTimeoutMillis`去赋值。

### Native层的MessageQueue和Looper
我们刚刚看`MessageQueue`的代码时候，看到`mPtr`，它对应native层的`MessageQueue`的指针。它的初始化在`MessageQueue`的构造方法中，也就是调用`nativeInit`，其内部源码为调用`NativeMessageQueue`的构造方法，源码在`android_os_MessageQueue.cpp`中：
```c++
NativeMessageQueue::NativeMessageQueue() :  
        mPollEnv(NULL), mPollObj(NULL), mExceptionObj(NULL) {  
    mLooper = Looper::getForThread();  
    if (mLooper == NULL) {  
        mLooper = new Looper(false);  
        Looper::setForThread(mLooper);  
    }  
}
```

这里我们可以看到在Native层，创建MessageQueue的时候，也会创建Looper，当然如果当前线程存在Looper则会直接使用。Native层的Looper跟Jav层一样，是存放在ThreadLocal当中的，可以看如下代码：
```c++
sp<Looper> Looper::getForThread() {  
    int result = pthread_once(& gTLSOnce, initTLSKey);  
    Looper* looper = (Looper*)pthread_getspecific(gTLSKey);  
    return sp<Looper>::fromExisting(looper);  
}
```

到这里，我们知道对于一个启动了消息循环的线程，它在Java层和Native层分别会有各自的MessageQueue和Looper，java层通过`mPtr`来引用Native层的对象，从而使得两层能够产生联系。

### Native层pollOnce
之前分析Java层获取消息的时候，会有一个地方调用`nativePollOnce`,它在native拿到`NativeMessageQueue`之后会调用它的`pollOnce`方法，代码如下：
```c++
void NativeMessageQueue::pollOnce(JNIEnv* env, jobject pollObj, int timeoutMillis) {  
    mPollEnv = env;  
    mPollObj = pollObj;  
    mLooper->pollOnce(timeoutMillis);  
    mPollObj = NULL;  
    mPollEnv = NULL;  
  
    if (mExceptionObj) {  
        env->Throw(mExceptionObj);  
        env->DeleteLocalRef(mExceptionObj);  
        mExceptionObj = NULL;  
    }  
}
```
这里的`pollObj`为我们java层的`MessageQueue`， 这里继续调用了native层的`pollOnce`，代码如下：
```c++
int Looper::pollOnce(int timeoutMillis, int* outFd, int* outEvents, void** outData) { //我们的调用流程只会传timeoutMillis
	...
	for (;;) {
		...
		result = pollInner(timeoutMillis);
	}
}
```

这里省略了一些结果处理的代码，我们可以回头在看，这可以看到开启了一个无限循环，并调用`pollInner`， 这个方法比较长，我们先分块看其中的代码：
```c++
if (timeoutMillis != 0 && mNextMessageUptime != LLONG_MAX) {  
    nsecs_t now = systemTime(SYSTEM_TIME_MONOTONIC);  
    int messageTimeoutMillis = toMillisecondTimeoutDelay(now, mNextMessageUptime);  
    if (messageTimeoutMillis >= 0  
            && (timeoutMillis < 0 || messageTimeoutMillis < timeoutMillis)) {  
        timeoutMillis = messageTimeoutMillis;  
    }
}
int result = POLL_WAKE;  
mResponses.clear();   //清除reponses列表和计数
mResponseIndex = 0;  
mPolling = true;  
  
struct epoll_event eventItems[EPOLL_MAX_EVENTS];  
int eventCount = epoll_wait(mEpollFd.get(), eventItems, EPOLL_MAX_EVENTS, timeoutMillis);  
  
mPolling = false;
```
这里`timeoutMillis`是我们从java层传过来的下一个消息的执行事件，而`mNextMessageUptime`是native层的最近一个消息的执行事件，这个根据这两个字段判断需要等待的事件。

在之后调用`epoll_wait`来等待I/O事件，或者到设置的超时时间结束等待，这样做可以避免Java层和Native层的循环空转。此处的`epoll_wait`除了避免循环空转还有另一个作用，我们之前在分析IMS也使用过`Looper`的`addFd`，这里如果对应的文件描述符有变化，这里就会拿到，并反应在`eventCount`上，这里我们先不具体分析，后面再看。

#### Native消息的读取和处理
当等待完成之后，就会去native的消息队列中取消息和处理，代码如下：
```c++
Done: ;
	mNextMessageUptime = LLONG_MAX;  
    while (mMessageEnvelopes.size() != 0) {  
        nsecs_t now = systemTime(SYSTEM_TIME_MONOTONIC);  
        const MessageEnvelope& messageEnvelope = mMessageEnvelopes.itemAt(0);
        if (messageEnvelope.uptime <= now) {  
            { 
                sp<MessageHandler> handler = messageEnvelope.handler;  
                Message message = messageEnvelope.message;  
                mMessageEnvelopes.removeAt(0);  
                mSendingMessage = true;  
                mLock.unlock();    
                handler->handleMessage(message);  
            }  
  
            mLock.lock();  
            mSendingMessage = false;  
            result = POLL_CALLBACK;  
        } else {  
            mNextMessageUptime = messageEnvelope.uptime;  
            break;  
        }  
    }
```

在Native中消息是放在`mMessageEnvelope`当中，这是一个verctor也就是一个动态大小的数组。不过不看这个的化，我们可以看到这里读取消息，以及读取它的执行时间`uptime`跟java层的代码是很像是的，甚至比java层还要简单许多，就是直接拿数组的第一条。之后使用`MessageHandler`执行`handleMessage`。这里的`MessageHandler`跟java层的也是很像，这里再列一下`MessageEnvelope`和`Message`的代码：
```c++
struct MessageEnvelope {  
    MessageEnvelope() : uptime(0) { }  
  
    MessageEnvelope(nsecs_t u, sp<MessageHandler> h, const Message& m)  
        : uptime(u), handler(std::move(h)), message(m) {}  
  
    nsecs_t uptime;  
    sp<MessageHandler> handler;  
    Message message;  
};

struct Message {  
    Message() : what(0) { }  
    Message(int w) : what(w) { }  
  
    /* The message type. (interpretation is left up to the handler) */  
    int what;  
};

```

这里和java层的区别是，拆分成了两个结构体，但是呢比java层的还是要简单很多。到这里Native层和Java层对应的消息循环体系就分析完了。但是Native层除了这个消息循环还有一些其他东西，就是前面说到的文件描述符的消息传递。
### 文件描述符消息读取和处理
前面在`pollOnce`中还是有关于文件描述符消息的处理，这里继续分析。前面的`epoll_wait`就会读取相关的事件，读取完事件之后的处理如下：
```c++
if (eventCount < 0) {   //如果读出来的eventCount小于0，则说明有错误
    if (errno == EINTR) {  //处理错误，并且跳转到Done去读取native层的消息
        goto Done;  
    }  
    result = POLL_ERROR;  
    goto Done;  
}

if (eventCount == 0) {  //直接超时，没有读到事件
        result = POLL_TIMEOUT;  
        goto Done;  
}

for (int i = 0; i < eventCount; i++) {  //根据返回的条数，来处理消息
    const SequenceNumber seq = eventItems[i].data.u64;  
    uint32_t epollEvents = eventItems[i].events;  
    if (seq == WAKE_EVENT_FD_SEQ) {  //序列为这个序列被定义成为唤醒事件
        if (epollEvents & EPOLLIN) {  
            awoken();  
        } else {  
        }  
    } else {  
        const auto& request_it = mRequests.find(seq);  
        if (request_it != mRequests.end()) {  
            const auto& request = request_it->second;  
            int events = 0;  
            if (epollEvents & EPOLLIN) events |= EVENT_INPUT;  
            if (epollEvents & EPOLLOUT) events |= EVENT_OUTPUT;  
            if (epollEvents & EPOLLERR) events |= EVENT_ERROR;  
            if (epollEvents & EPOLLHUP) events |= EVENT_HANGUP;  
            mResponses.push({.seq = seq, .events = events, .request = request});  
        } else {  
	        ...
        }  
    }  
}

```

前面的错误处理我们直接看我的注释即可。后面会根据返回的eventCount来一次对每一个`eventItem`做处理，其他它的u64为序列号，这些为注册到`Looper`的`mRequests`的序列号，其中1为`WAKE_EVENT_FD_SEQ`,也就是`mWakeEventFd`的序列，这里唤醒我们先不管了，直接看后面的正常的文件描述符事件监听。
这里首先会通过seq找到对应的Request，并根据`epollEvents`来设置他们的事件类型，之后封装成为`Response`放到`mResponses`当中。在这些做完，后面同样是跳转到Done后面的代码块，代码如下：
```c++
Done: ;
	...
	for (size_t i = 0; i < mResponses.size(); i++) {  
        Response& response = mResponses.editItemAt(i);  
        if (response.request.ident == POLL_CALLBACK) {  
            int fd = response.request.fd;  
            int events = response.events;  
            void* data = response.request.data;  
            int callbackResult = response.request.callback->handleEvent(fd, events, data);  
            if (callbackResult == 0) {  
                AutoMutex _l(mLock);  
                removeSequenceNumberLocked(response.seq);  
            }  
  
            response.request.callback.clear();  //移除response对与callback的引用
            result = POLL_CALLBACK;  
        }  
    }
```
这里则是遍历刚刚我们填充的`mResponses`数组，从其中取出每一个Response，并调用它的Request的Callback回调的`handleEvent`方法，它的使用我们之前分析`IMS`和`ServiceManager`启动的时候已经见到过了。


以上说的是Java层会初始化Handler和Looper的情况，如果只是Native层使用的话，一般怎么用的呢。我们以`BootAnimation`中的使用为例，它是在`BootAnimation.cpp`当中，在初始化`BootAnimation`对象的时候，会创建一个`Looper`，代码如下：
```c++
new Looper(false)
```
在`readyToRun`中添加文件描述符的监听：
```c++
status_t BootAnimation::readyToRun() {
	...
	mLooper->addFd(mDisplayEventReceiver->getFd(), 0, Looper::EVENT_INPUT, 
        new DisplayEventCallback(this), nullptr);
}
```

最后去循环调用`pollOnce`，来获取消息：
```c++
bool BootAnimation::android() {
 do {
	 processDisplayEvents();
	 ...
 } while (!exitPending());
}

void BootAnimation::processDisplayEvents() {  
   mLooper->pollOnce(0);  
}
```

这就是Android Framework当中，大部分的Native场景使用消息循环的方式。而Native中，想要跟Java层一样发送消息，则是调用Looper的`sendMessage`方法。而Native层的Handler我们可以理解为只是一个Message的回调，和java层的Handler功能不可同日而语。

### 异步消息
在Java层的消息循环中，消息是有同步和异步之分的，异步消息一般都会伴随则屏障消息，我们之前分析的获取next消息中可以看到，如果第一个消息是屏障消息，会找后面的第一条异步消息来执行。

同时在`enqueueMessage`的代码中也有如下逻辑：
```java
//MessageQueue.java
needWake = mBlocked && p.target == null && msg.isAsynchronous();  
Message prev;  
for (;;) {  
    prev = p;  
    p = p.next;  
    if (p == null || when < p.when) {  
        break;  
    }  
    if (needWake && p.isAsynchronous()) {  
        needWake = false;  
    }  
}  
msg.next = p; 
prev.next = msg;
```
插入异步消息会改变唤醒等待的状态，如果链表头是屏障消息，且之前调用next的时候`mBlocked`设置为了true，且当前是异步消息会设置成唤醒，但是如果当前的消息队列中已经有了比当前消息更早执行的消息，则不会唤醒。

到这就完成了消息循环的所有分析了。也欢迎读者朋友交流探讨。