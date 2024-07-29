---
layout: post
title: "记录再次编译Android系统的坑"
date: 2024-07-29T11:05:34+0800
tags: ["Android", "Android源码"]
comments: true
feature: 
---

之前已经多次编译过Android系统的代码，但是一直没有静下来去阅读Android源代码。最近不太忙，决定开始好好读读系统源码。这篇文章作为开篇，先记录把Android系统编译出来，并且把源码阅读的环境准备好。

<!--more-->

首先介绍一下，这次使用的是Ubuntu22.0.4 LTS版本，起初准备使用虚拟机安装，但是映射虚拟硬盘老是出问题，还是直接搞上了Windows &  Ubuntu双系统，Ubuntu安装到移动硬盘里面，插上移动硬盘就能用Ubuntu，拔掉还能使用Windows系统。为什么要用移动硬盘，因为官方说了至少要留400G空间给源码和编译所需，不过我最后测下来300G也是够的。

为什么选择Ubuntu 22.0.4而不是最新的Ubuntu 24.0.4，是因为22.0.4后面的版本移除了`libncurses.so.5`，在22.0.4版本的时候我们还可以通过以下的命令安装，而后面的版本我们可能就只能使用android源码提供的相关库，并且自己去做文件的映射处理，反正我试过之后发现还是有问题，就重新安装了Ubuntu 22.0.4。
```shell
sudo apt install libncurses5
```

除此之外我们按照官方教程来做就行了。

首先是安装必备的软件工具包：

```shell
sudo apt-get install git-core gnupg flex bison build-essential zip curl zlib1g-dev libc6-dev-i386 x11proto-core-dev libx11-dev lib32z1-dev libgl1-mesa-dev libxml2-utils xsltproc unzip fontconfig
```
安装repo，可以自己下载最新版本，也只直接使用ubuntu的软件包安装：
```shell
sudo apt-get install repo
```

设置git的用户信息:
```shell
git config --global user.name "user name"
git config --global user.email "user@email.com"
```
创建一个目录，然后在这个目录下面初始化Android系统 Repo
```shell
repo init -u https://android.googlesource.com/platform/manifest -b master
```

`-u`后面是Android仓库的清单文件地址， `-b`是我们要拉出来的代码分支，可以是分支名称，也可以是tag名称，我选择的是Android 13的源码，用了这个tag： `android-13.0.0_r83`。

然后就可以调用`repo sync`来下载代码了，这个过程可能需要等待几个小时，看你的网速，可以在后面加上` -c -j线程数`来加快速度，`-c`表示拉当前分支，`-j`开启多个线程下载，如：
```shell
repo sync -c -j16
```

下载过程中如果中断了，重新执行这个命令可以继续下载，如果有遇到错误说有`.lock`文件，去子文件夹的.git文件夹下面找到相关的lock文件删除再重试就行了。

下载完我们在工作目录，首先执行以下代码，初始化工作环境和一些命令：
```shell
source ./build/envsetup.sh
```

执行以下命令，初始化我们要构建的目标：
```shell
lunch sdk_phone_x86_64-eng
```
以上这两句，我们需要每次启动一个终端或者重启电脑后都需要运行，不然m和emulator等命令都用不了。

然后后面的目标也可以不写，这样会进入一个选择列表让你选要构建的目标。
之后就可以输入`m`来构建系统了。

构建完系统在命令行执行`emulator`理论上就可以在模拟器中运行我们的系统了。但是我这里模拟器确黑屏了，只有一个小窗口，运行失败，命令行日志只看到`libvulkan.so`移动失败，但是看了以下模拟器的目录下面，是有这个文件的，然后在这台电脑上安装了android sdk，在其中创建了AVD，并启动它，发现是可以的。
这个时候想到一个妙招，就是把sdk的模拟器拷贝到我们源码的模拟器目录，把这边的模拟器给替换掉。然后神奇的事情发生了，我们编译出来的系统运行成功了。如果你遇到类似的情况也可以这样试试，把android sdk目录中的模拟器复制到`./prebuilts/android-emulator/linux-x86_64`目录下面。

关于阅读源码，之前大家都是使用idegen来生成适用于Android Studio的工程文件，但是默认会把所有文件都导入，打开速度极慢，我想这可能也是我之前无法把代码阅读下去的一个理由。在去年，android官方推出了Android Studio For Platform，可以这里下载： [https://developer.android.com/studio/platform](https://developer.android.com/studio/platform) ,UI跟Android Stuido一样，不过它可以帮我们自动执行source 和launch命令，以及对于platform的module的设置，导入的时候我们选择自己要构建的target就行了，使用几天下来是很好用的。

![](https://img.isming.me/image/asfp.png)

除了使用Android Studio platform 在Android 10之后google还为我们提供了AIDEGen这个工具，我就没花时间去用了，感兴趣的可以看看这个博主的文章：[https://juejin.cn/post/7276812358663733263](https://juejin.cn/post/7276812358663733263)

以上就是我这次的编译过程，期待对大家有用。在此立个Flag，后续把阅读Android源码的内容也写出来。

一些参考的资料：
1. [下载 Android 源代码-官方资料](https://source.android.com/docs/setup/download/downloading?hl=zh-cn)      
2. [针对 AOSP 开发进行设置（9.0 或更高版本）-官方资料](https://source.android.com/docs/setup/start/requirements?hl=zh-cn)        
3. [构建Android-官方资料](https://source.android.com/docs/setup/build/building?hl=zh-cn)      
4. [AndroidStudio导入Android系统源码](https://juejin.cn/post/7276812358663733263)

