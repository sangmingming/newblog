---
layout: post
title: Android Binder源码分析：AIDL及匿名服务传输
date: 2024-09-07T17:57:32+0800
tags:
  - 技术
  - Android
  - Android源码
keywords:
  - Android
  - binder
  - SourceCode
  - OS
  - AIDL
comments: true
feature:
---

前面介绍的通过ServiceManager添加服务和获取服务，这些服务都是有名称的，我们可以通过`ServiceManager`来获取它。除此之外Android系统中还有一类Binder服务是匿名它，它们如何让客户端获得代理对象，并且使用呢，本文就一探究竟。

<!--more-->

### AIDL 介绍
AIDL全称为Android接口定义语言，是Android系统提供的一款可供用户用来抽象IPC的工具，它提供了语法让我们来定义跨进程通讯的服务接口，也就是`.aidl`文件，它也提供了工具，帮助我们把定义文件专程目标语言的代码。

我们自己使用AIDL创建的服务，或者一部分系统内的服务，比如`IWindowSession`、`IApplicationThread`等，这些多是运行在App进程，一般都不是系统服务，因此都是匿名的。我们这里以`IApplicationThread`来分析AIDL创建的匿名服务是怎么传递Binder给使用端的。

以`IApplicationThread`来分析，则服务端是我们的App进程，而客户端则是system_server进程。作为AIDL创建的Binder，首先会有一个AIDL文件，这里是`IApplicationThread.aidl`，其中定义了一些跨进程调用的方法，部分内容如下：
```aidl
package android.app;
...
oneway interface IApplicationThread {  
    void scheduleReceiver(in Intent intent, in ActivityInfo info,  
            in CompatibilityInfo compatInfo,  
            int resultCode, in String data, in Bundle extras, boolean sync,  
            int sendingUser, int processState);  
    @UnsupportedAppUsage  
    void scheduleStopService(IBinder token);
	...
}
```

当前Android AIDL已经支持生成Java、C++、Rust的代码，对于`IApplicationThread`这里我们只需关注生成Java版本的代码即可。生成的代码在`IApplicationThread`当中，大概如下所示：
```java
public interface IApplicationThread extends android.os.IInterface {
public static class Default implements android.app.IApplicationThread {
	@Override
	public void scheduleReceiver(android.content.Intent 
							...) throws android.os.RemoteException {}

	@Override
	public android.os.IBinder asBinder() {
		return null;
	}
}
  
public abstract static class Stub extends android.os.Binder
	implements android.app.IApplicationThread {
	public Stub() {
		this.attachInterface(this, DESCRIPTOR);
	}

	public static android.app.IApplicationThread asInterface(android.os.IBinder obj) {
		if ((obj == null)) {
			return null;
		}
		android.os.IInterface iin = obj.queryLocalInterface(DESCRIPTOR);
		if (((iin != null) && (iin instanceof android.app.IApplicationThread))) {
			return ((android.app.IApplicationThread) iin);
		}
		return new android.app.IApplicationThread.Stub.Proxy(obj);
	}

	@Override
	public android.os.IBinder asBinder() {
		return this;
	}

	public static java.lang.String getDefaultTransactionName(int transactionCode) {
		switch (transactionCode) {
		case TRANSACTION_scheduleReceiver:{
			return "scheduleReceiver";
		}
		case TRANSACTION_scheduleCreateService: {
			return "scheduleCreateService";
		}
		default: {
			return null;
		}
		}
	}

	public java.lang.String getTransactionName(int transactionCode) {
		return this.getDefaultTransactionName(transactionCode);
	}

	@Override
	public boolean onTransact(int code, android.os.Parcel data, android.os.Parcel reply, int flags)
	throws android.os.RemoteException {
		java.lang.String descriptor = DESCRIPTOR;
		if (code >= android.os.IBinder.FIRST_CALL_TRANSACTION
			&& code <= android.os.IBinder.LAST_CALL_TRANSACTION) {
			data.enforceInterface(descriptor);
		}
		switch (code) {
		case INTERFACE_TRANSACTION:{
			reply.writeString(descriptor);
			return true;
		}
		}

		switch (code) {
		case TRANSACTION_scheduleReceiver:{
			android.content.Intent _arg0;
			_arg0 = data.readTypedObject(android.content.Intent.CREATOR);
			...
			int _arg8;
			_arg8 = data.readInt();
			data.enforceNoDataAvail();
			this.scheduleReceiver(_arg0, _arg1, _arg2, _arg3, _arg4, _arg5, _arg6, _arg7, _arg8);
			break;
		}
		...
		default:{
			return super.onTransact(code, data, reply, flags);
		}
		}
		return true;
	}

	private static class Proxy implements android.app.IApplicationThread {
		private android.os.IBinder mRemote;

		Proxy(android.os.IBinder remote) {
			mRemote = remote;
		}

		@Override
		public android.os.IBinder asBinder() {
			return mRemote;
		}

		public java.lang.String getInterfaceDescriptor() {
			return DESCRIPTOR;
		}

		@Override
		public void scheduleReceiver(
			android.content.Intent intent,
			...
			int processState) throws android.os.RemoteException {
			android.os.Parcel _data = android.os.Parcel.obtain();
			try {
				_data.writeInterfaceToken(DESCRIPTOR);
				...
				_data.writeTypedObject(intent, 0);
				boolean _status = mRemote.transact(
					Stub.TRANSACTION_scheduleReceiver, _data, null, android.os.IBinder.FLAG_ONEWAY);
			} finally {
				_data.recycle();
			}
		}
		...
	}

	public static final java.lang.String DESCRIPTOR = "android.app.IApplicationThread";
	static final int TRANSACTION_scheduleReceiver = (android.os.IBinder.FIRST_CALL_TRANSACTION + 0);
	static final int TRANSACTION_scheduleCreateService = (android.os.IBinder.FIRST_CALL_TRANSACTION + 1);
...
	public int getMaxTransactionId() {
		return 57;
	}
}	
...
public void scheduleReceiver(
android.content.Intent intent,
...
int processState)
throws android.os.RemoteException;

}

```
对于Java代码，AIDL会生成一个跟AIDL同名的接口，同时继承自`IInterface`,同时还会创建内部类，分别为Default和Stub。Default为默认实现，大多数情况下是没有的，因为我们自己会实现。而Stub为抽象类，我们自己实现的时候会使用它，它以及继承自`Binder`，AIDL工具帮助我们把Parcel读写相关的代码已经生成，我们只需要去继承它，实现业务逻辑即可。而`Stub`中还有一个内部类`Proxy`,这个类用于Binder服务的客户端使用。对于`IApplicationThread`的实现，在`ActivityThread`当中。

### 匿名服务的传输
那么ActivityServiceManager(之后简称AMS)是怎么拿到`ApplicationThread`的呢，`ActivityThread`的attach方法则是这一切的入口：
```java
final IActivityManager mgr = ActivityManager.getService();  
try {  
    mgr.attachApplication(mAppThread, startSeq);  
} catch (RemoteException ex) {  
    throw ex.rethrowFromSystemServer();  
}
```

代码中，首先拿到`AMS`的binder客户端类，这里也就是`IActivityManager$Stub$Proxy`，因为它也用了AIDL，所以跟我们`ApplicationThread`的类是类似的，具体如何拿到的，这个之前ServiceManager分析getService的时候已经分析过了，这里不看了。我们可以看一下它的`attachApplication`方法，代码如下：
```java
@Override public void attachApplication(android.app.IApplicationThread app, long startSeq) throws android.os.RemoteException  
{  
  android.os.Parcel _data = android.os.Parcel.obtain();  
  android.os.Parcel _reply = android.os.Parcel.obtain();  
  try {  
    _data.writeInterfaceToken(DESCRIPTOR);  
    _data.writeStrongInterface(app);  
    _data.writeLong(startSeq);  
    boolean _status = mRemote.transact(Stub.TRANSACTION_attachApplication, _data, _reply, 0);  
    _reply.readException();  
  }  
  finally {  
    _reply.recycle();  
    _data.recycle();  
  }  
}
```

这里也是跟我们之前addService类似，把binder写入到Parcel中去，因为App进程这里相当于是ApplicationThread它的服务端，因此这里写入的type为`BINDER_TYPE_BINDER`，而调用`mRemote.transact`则为调用`BinderProxy`的同名方法，我们知道最终会调用到`IPCThreadState`的`transact`方法，从而调用binder驱动。

类似于getService的方法，AMS所在的system_server进程会收到`BR_TRANSACTION`命令，在其中解析数据知道调用的是`TRANSACTION_attachApplication`这个业务命令，进而使用`readStrongInterface`来获取到binder的代理对象`BinderProxy`。具体代码在`IActivityManager.Stub`的`onTransact`中，代码如下：
```java
case TRANSACTION_attachApplication:  
{  
  android.app.IApplicationThread _arg0;  
  _arg0 = android.app.IApplicationThread.Stub.asInterface(data.readStrongBinder());  
  long _arg1;  
  _arg1 = data.readLong();  
  data.enforceNoDataAvail();  
  this.attachApplication(_arg0, _arg1);  
  reply.writeNoException();  
  break;  
}
```

到这样调用`AMS`服务端的`attachApplication`的时候就能使用`IApplicationThread`所提供的方法了。

### Binder驱动中binder节点的处理

但是看到这里，有个问题，就是我们是匿名的binder，驱动怎么是处理的呢。这个需要去看一下binder驱动的源码，不过就不具体看调用流程了，直接看生成创建node和handle部分的代码:
```c
static int binder_translate_binder(struct flat_binder_object *fp,  
                                   struct binder_transaction *t,  
                                   struct binder_thread *thread)  
{  
    struct binder_node *node;  
    struct binder_proc *proc = thread->proc;  
    struct binder_proc *target_proc = t->to_proc;  
    struct binder_ref_data rdata;  
    int ret = 0;  
  
    node = binder_get_node(proc, fp->binder);  
    if (!node) {  
        node = binder_new_node(proc, fp);  
        if (!node)  
            return -ENOMEM;  
    }  
    ...  
    ret = binder_inc_ref_for_node(target_proc, node,  
                                  fp->hdr.type == BINDER_TYPE_BINDER,  
                                  &thread->todo, &rdata);  
    ...  
    if (fp->hdr.type == BINDER_TYPE_BINDER)  
        fp->hdr.type = BINDER_TYPE_HANDLE;  
    else  
        fp->hdr.type = BINDER_TYPE_WEAK_HANDLE;  
    fp->binder = 0;  
    fp->handle = rdata.desc;  
    fp->cookie = 0;  
  
    ...  
    done:  
    binder_put_node(node);  
    return ret;  
}
```

可以看到对于通过Parcel调用经过binder驱动的binder对象，binder驱动都会给他们创建一个`binder_node`,并且为其设置handle，在传输到客户端的时候还会把`type`设置为`BINDER_TYPE_HANDLE`。
这样我们就对整给流程有所了解了，如果读者还想窥探更多的细节，则需要自行去阅读binder驱动的源码了。

### 开发者如何使用匿名服务
这上面介绍的部分是我们使用系统的服务来获取AIDL创建的服务，对于应用开发者来说有什么办法呢。我们可以通过AIDL+Service来实现，Android的四大组件之一的`Service`，它提供了通过`bindService`的方式来启动服务。在它的`onBind`中就可以返回`IBinder`，Android Framework会帮助我们调用操作代码如下：
```java
private void handleBindService(BindServiceData data) {  
    CreateServiceData createData = mServicesData.get(data.token);  
    Service s = mServices.get(data.token);  
    if (s != null) {  
        try {  
           ....
            try {  
                if (!data.rebind) {  
                    IBinder binder = s.onBind(data.intent);  
                    ActivityManager.getService().publishService(  
                            data.token, data.intent, binder);  
                } else {  
                    ...
                }  
            } catch (RemoteException ex) {  
                throw ex.rethrowFromSystemServer();  
            }  
        } catch (Exception e) {  
            ....
        }  
    }  
}
```
可以看到在`ActivityThread`的`handleBindService`方法 中，我们在拿到Service所提供的`IBinder`之后，`AMS`会调用`publishService`，我们可以在`ServiceConnection`回调中拿到`Binder`的代理对象，之后就可以进行跨进程通讯了。

另外Android Framework还为我们提供了`Messenger`，其实现为Service+AIDL+Handler，让我们不用自己写AIDL，我们自己定义Service的时候使用Messenger和Handler就可以实现跨进程通信了。


### 总结
到此为止，我们已经分析了Binder服务管家ServiceManager的启动、使用ServiceManger添加服务和查找服务以及匿名服务的传递，在此过程中我们了解了进程是如何与Binder驱动交互的，以及binder调用过程中的会执行的方法等，我们对于Binder就有了一个全面的了解。在本文还简单介绍 了应用开发者如何使用Binder，有了这些基础，我们后面分析Android系统其他部分的代码就会更加容易了。当然关于Binder驱动的代码，BInder线程池的管理这两块还没有分析，读者感性确可以自行阅读，也可查看其他博主的文章。

如果你也对于Android系统源码感兴趣，欢迎与我交流。博文因为个人局限，也难免会出现差错，欢迎大家指正。
