---
layout: post
title: "使用Cuttlefish运行自编译Android固件"
date: 2024-11-21T16:13:07+0800
tags: ["Android", "Android源码", 折腾]
comments: true
feature: 
---

最近把本地的Android源码升级到了最新的Android 15，用于看Android源码的Android Studio for Platform也升级到了最新版本，Google的Cuttlefish最近发布了1.0版本，也顺便折腾了一下使用Cuttlefish来运行自己编译的Android系统，这里就介绍一下如何使用和遇到的问题。

<!--more-->

### Cuttlefish是什么
Cuttlefish是谷歌推出的一种可以配置的虚拟Android设备，它可以运行在我们本地设备上，也可以运行在服务器上面，官方也提供了Docker运行的支持，理论上可以运行在本地或者服务器的Debian设备上，或者运行在Google Compute Engine上。

用官方的化来说，它是一个更接近真实设备的Android模拟器，除了硬件抽象层（HAL）之外，它和实体设备的功能表现基本上是一致的。使用它来做CTS测试，持续集成测试会有更高的保真度。

在命令行中运行它，是没有类似模拟器的UI的，我们可以通过两种方式看到它的UI，一种是通过ADB连接，另一种则是开启它的webrtc功能，在浏览器中查看和交互。而他的虚拟硬件功能，可以让我们模拟多个屏幕，测试蓝牙wifi等各种功能。

### 安装Cuttlefish，编译Android固件
首先我们需要检查我们的设备是否支持KVM虚拟化，使用下面的命令：
```shell
grep -c -w "vmx\|svm" /proc/cpuinfo
```
如果得到一个非0的值，就是支持的。

之后我们需要有一个Android固件，可以选择去[Android持续集成网站](https://ci.android.com/builds/branches/aosp-main/grid?legacy=1)下载他们编译好的固件，也可以自己编译固件。下载固件要注意下载设备目标中带cf的，并且下载的目标CPU需要和需要运行的宿主机CPU架构一样，ARM就下载ARM的，X86就下载X86_64的，具体的操作可以看官方教程。我这里则是自己编译，使用如下代码设备我要编译的选项：
```shell
lunch aosp_cf_x86_64_phone-trunk_staging-eng
```

这样有了固件，还是不能够运行的。我们还需要去编译Cuttlefish，在[https://github.com/google/android-cuttlefish](https://github.com/google/android-cuttlefish)下载源码后，在cuttlefish源码目录下执行如下代码编译和Android：
```shell
tools/buildutils/build_packages.sh
sudo dpkg -i ./cuttlefish-base_*_*64.deb || sudo apt-get install -f
sudo dpkg -i ./cuttlefish-user_*_*64.deb || sudo apt-get install -f
```
如果你很幸运的化，上面会一次成功，但是我不是个幸运儿。于是了类似如下的错误：
```shell
While resolving toolchains for target //src/tools/ak/generatemanifest:generatemanifest (6312974): invalid registered toolchain '@local_jdk//:bootstrap_runtime_toolchain_definition': no such target '@local_jdk//:bootstrap_runtime_toolchain_definition': target 'bootstrap_runtime_toolchain_definition' not declared in package '' defined by /home/sam/.cache/bazel/_bazel_jcater/ddb4e20e0e2e6bca92f5deeef02ce168/external/local_jdk/BUILD.bazel (Tip: use `query "@local_jdk//:*"` to see all the targets in that package)
```

这个错误的原因呢，就是因为编译cuttlefish的时候使用了bazel这个构建工具，它依赖JDK，而我没有设置`JAVA_HOME`这个环境变量，因此把它加入到环境变量中就好了。类似如下：
```
export JAVA_HOME=/usr/lib/jvm/zulu-17-amd64
```
设置完成之后在Cuttlefish项目目录用如下命令检查一下，看看JAVA_HOME是否设置正确：
```shell
bazel info java-home
```
但是搞完之后，在安装这两个deb文件的时候又遇到了问题，告诉我我电脑上的`grub-common`签名有错误，这个呢是因为我之前添加了铜豌豆的软件源，grub升级的时候升级了铜豌豆的grub软件包，它和ubuntu官方的不同，于是卸载掉铜豌豆软件源，grub-common也重新安装，之后就没问题了。
这些做完之后，我们执行下面的命令设置环境，并且重启电脑就好了。
```shell
sudo usermod -aG kvm,cvdnetwork,render $USER
sudo reboot
```

### 使用Cuttlefish
在我们的已经编译完Android系统目录中首先执行如下代码让环境初始化好：
```shell
source ./build/envsetup.sh
lunch aosp_cf_x86_64_phone-trunk_staging-eng
```

随后执行如下的命令就可以启动Cuttlefish运行Android了：
```shell
launch_cvd --daemon
```

如果你是从Android官方下载的，那么会和我这有一些区别，可以去看一下官方教程。

这个时候我们就可以通过adb看看设备是否已经启动了，也可以在浏览器中打开，在本机浏览其打开使用如下地址和端口：
```
https://localhost:8443/
```
![](https://img.isming.me/image/cuttlefish-webview.png)

地址一定要使用https，点击左侧的swtich按钮就可以看到UI了。
webrtc是默认打开的，关于它的命令行更多使用方式可以查看官方文档，可以使用如下的命令查看。
```shell
launch --help
```
而关闭Cuttlefish，也很简单，使用如下的命令：
```shell
stop_cvd
```

### 新版Android Studio for Platform使用
2023版本的Android Studio for Platform（以下简称Asfp）在打开的时候是有一个单独的`Open Aosp project`选项的，而新版本的这个选项去掉了。刚刚使用它的时候我还一脸懵逼，测试了Import和Open都不行，结果最后发现新版的`New`选项就直接是导入Aosp工程了。

使用方式如下图。
![](https://img.isming.me/image/import-aosp-1.png)

![](https://img.isming.me/image/import-aosp-2.png)

我们可以根据上图选择我们需要导入的Module，选择Asfp给我们生成的项目文件存放的位置，之后Asfp会执行`lunch`的操作和它需要的一些依赖构建。在我们选定的目录下面也会生成一个`asfp-config.json`文件，它就是我们的项目设置，如果我们以后有变化了（比如想看不同的模块的代码），也可以直接修改这个文件。
```json
{
  "repoRoot" : "/home/sam/android/android-source",
  "modulePaths" : [
    "frameworks",
    "packages/inputmethods"
    ],
  "lunchTarget" : "aosp_cf_x86_64_phone-trunk_staging-eng",
  "nativeConfig" : {
    "excludePaths" : [ ],
    "excludeGenPaths" : [ ]
  },
  "syncConfig" : {
    "environmentVars" : { },
    "buildFlags" : [ ]
  }}
```

参考内容和资料：
1. Cuttlefish 官方文档： [https://source.android.com/docs/devices/cuttlefish](https://source.android.com/docs/devices/cuttlefish)
2. Cuttlefish官方Repo： [https://github.com/google/android-cuttlefish](https://github.com/google/android-cuttlefish)
3. Bazel用户指南：[https://bazel.build/docs/user-manual](https://bazel.build/docs/user-manual)
4. Android Cuttlefish emulator: [https://2net.co.uk/blog/cuttlefish-android12.html](https://2net.co.uk/blog/cuttlefish-android12.html)