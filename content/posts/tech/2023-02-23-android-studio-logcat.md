---
layout: post
title: "新版Android Studio Logcat view使用简明教程"
date: 2023-02-23 23:10:52 +0800
comments: true
tags: [Android,技术]
slug: "android-studio-logcat"
---

![logcat-window.png](/images/photo/logcat-window.png)

从Android Studio Dophin开始，Android Studio中的默认展示了新版的logcat。新版的logcat色彩上是更加的好看了，不同的tag会有不同的颜色，不同level等级的log默认也有不同的颜色。log过滤修改的更简洁了，当然使用起来也更加复杂了。原先的log视图只需要勾选就可以选择不同level的log了，只需要选择只展示当前应用的log就可以过滤掉其他应用的log了，但是新版只提供了一个输入框去过滤。在经过几个月的适应和对于官方文档的学习后，终于使用了，这里简单记录和分享一下。

<!--more-->


### 定义自己专属的log view
log view 默认提供了两种视图，Standard View 和Compat View。Stand View会展示每一条log的日期，时间，进程线程id，tag，包名，log level以及message。Compat View只展示时间，log level和详细的message。可以通过log view左边的**Configure Logcat Formatting Options**按钮来修改，同时这个按钮中还有一个**Modify Views**选项可以来修改standard和 Compat视图的具体展示内容，可以定制自己的logview样式，如下图所示。

![logcat-view-setting.jpg](/images/photo/logcat-view-setting.jpg)

个性化的logcat 视图不仅仅是可以自定义展示的内容，还可以修改log和filter的配色方案。前往**Settings(Windows)/Preferences(Mac) ->Editor -> Color Scheme**，选择**Android Logcat**即可修改log 的颜色，选择**Logcat Filter**即可修改filter的颜色。

以上修改的是logcat view的外表，我们还可以修改它的内核，一个是logcat循环滚动区的大小，以及新logcat window的默认filter，可以通过前往**Settings(Windows)/Preferences(Mac) -> Tools -> Logcat** 设置。

### 一些操作技巧
在标准布局下，或者我们的log太长的时候，一屏通常展示不下，我们需要不停的向右滑动，滚动才能看到log的信息，我们可以用log view左侧的**Soft-Wrap** ![logcat-soft-wrap.png](/images/photo/logcat-soft-wrap.png)按钮来让log换行。


左侧的Clear Logcat按钮可以清空logcat。左侧的Pause按钮可以暂停logcat的输出，方便看错误日志，可以避免关心的日志被新的日志冲掉。

新版本中，可以通过点击logcat tab右侧的**New tab** ![logcat-new-tab.png](/images/photo/logcat-new-tab.png)按钮来同时创建多个logcat view窗口。这种方式创建的不能同时展示，而利用logcat view左侧的split Panels 按钮则可以创建多个窗口，并且同时展示。每一个窗口都可以设置自己要展示的连接设备，展示样式，以及过滤选项。这样就可以很方便的同时观察多种log。

![logcat-multi-window.jpg](/images/photo/logcat-multi-window.jpg)



### 通过键值对来过滤Log

![logcat-query-suggestions.png](/images/photo/logcat-query-suggestions.png)

新的过滤器，看起来简单，实际上更加复杂且强大了。通过`Ctrl`+`Space`按键可以查看系统建议的一些查询列表。这里介绍一下查询中会用到的键：
+ **tag**: 匹配日志的tag字段
+ **package**：匹配记录日志的软件包名，其中特殊值**mine**匹配当前打开项目对应的应用log。
+ **process**：匹配记录日志的进程名
+ **message**：匹配日志中我们自己填写的message的部分。
+ **level**：与指定或者更高级别的日志匹配，比如debug或者error，输入level后as会自动提示可以选择。
+ **age**：让窗口中只保留最近一段时间的log，值为数字加单位，s表示秒，m表示分钟，h表示小时，d表示天。如age:10s就只保留最近10s的日志。
+ **is**: 这个键有两个固定的value取值，`crash`匹配应用崩溃日志，`stacktrace`匹配任意类似java堆栈轨迹的日志，这两个对于看crash查问题是非常好用的。

这么多的键匹配，是可以逻辑组合的。我们可以使用`&`和`|`以及圆括号，系统会强制执行常规的运算符优先级。`level:ERROR | tag:foo & package:mine` 会被强转为`level:ERROR | （tag:foo & package:mine ) `。如果我们没有填写逻辑运算符，查询语言会将多个具有相同键的非否定过滤视为`OR`，其他过滤视为`AND`。
如：
`tag:fa tag:ba package:mine` 计算逻辑是 `(tag:fa | tag:ba) & package:mine`
但`tag:fa -tag:ba package:mine` 计算逻辑是 `tag:fa & -tag:ba & package:mine`。这里的-用来表示否定，既tag不包含ba的情况。

新版的logcat view当然也是支持正则的，tag、message、package、process这几项是支持正则的。使用正则需要在键后面加一个`~`，例如： `tag~:My.*Report`。
除了正则这个选项之外，这几个键还有完全匹配和包含字符串即可的选项。不加修饰符号就是包含指定的字符串即可匹配。如果后面加`=`则要完全匹配才可以，例如`process=:system_server`和`process:system_ser`可以匹配到system_server的log，但是`process=:system_ser`则无法匹配到。

同时如上几个匹配选项都支持和前面说的否定符号连用如：`-process=:system_server`。

既然新版支持了这么复杂和强大过滤功能，如果每次都现想现写，那肯定是头皮发麻。as也为我们提供了收藏和历史记录功能。点击右侧的的星星按钮即可收藏当前的过滤条件，点击左侧的漏斗即可查看历史和收藏，并且可以删除不想要的记录。

### 切换回旧版log view
最后的最后，如果你觉得新版本适应不了，还是想要切换回旧版本的log view，还想要保留新版的android studio，也还是可以通过修改设置进行切换的。
前往**Settings(Windows)/Preferences(Mac) -> Experimental**, 反选`Enable new logcat
 tool window` 即可，如下图所示。
 
![disable_new_logview.jpg](/images/photo/disable_new_logview.jpg)

学习工具的目的，是为了让工具更好的为我们服务。希望大家都能够通过使用as提供的新功能来提高效率，从而有更多的时间去风花雪月。

参考：[https://developer.android.com/studio/debug/logcat](https://developer.android.com/studio/debug/logcat)