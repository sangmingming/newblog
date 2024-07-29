---
layout: post
title: "记国产手机无法在Chrome使用Passkey问题解决"
date: 2024-04-23 20:30:12 +0800
tags: ["Android", "技术杂谈"]
comments: true
feature: 
---

众所周知，在国产Android系统上面，Google play service是被阉割掉的。部分厂商提供了打开google play service的选项，让我们可以登录google 账号，使用Google play store，以及部分的Google 云服务，但是Google password manager以及Credential Api确是没有的。在Android手机上面，Passkey是依赖于GMS和 Credential Manager API的，因此，国行手机上面也就没法使用passkeykey。不过使用Chrome浏览器的话，还是能够使用Passkey的，这是因为Chrome提供了相关的实现。然而，前几日Chrome升级后，我的Passkey突然就不能使用了。
<!--more-->
首先尝试了重新卸载重装Chrome，手机的google账号管理里面测试passkey等等，结果还是不行。最后只得尝试在Google搜索，找了很多，发现了这样一个页面[How do I use Passkeys in Google Chrome on Android?](https://1password.community/discussion/143903/how-do-i-use-passkeys-in-google-chrome-on-android), 其中介绍的是如何在android手机上使用1password。其中关于chrome的flag部分引起来我的注意，因为Android 14后开始支持使用除了google password外其他的应用提供的passkey功能，所以我猜想可能是因为这个，google 最近改动了chrome关于passkey的逻辑，默认会使用手机系统的Credential Management Api而不是Chrome自己内置的Api。尝试了一下把这个Flag改为*Disabled*, 重启一下Chrome，Passkey又工作正常了。

操作方法为Chome地址栏中输入： 
```
chrome://flags
```
然后搜索Passkey，出现这个条目之后，修改其设置。

![](https://img.isming.me/image/passkeyflag.png)


另外还要说一下，虽然Chrome中的passkey使用问题解决了，但是因为手机内没有Credential Manager Api，应用还是没法使用passkey的。除此之外，通过手机扫码，让电脑使用passkey的时候，也会一直处在连接中，最后也会失败，目前这个也无解。因此，如果想要顺畅的使用Passkey只要两个解决办法，一个方式是换iPhone，另一个方法是买一个海外版的Android手机，比如Google 的Pixel，三星，或者尝试一下海外版本的ROM。
