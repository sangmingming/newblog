---
layout: post
title: Chromebook折腾之2025
date: 2025-03-05T14:40:56+0800
tags:
  - 折腾
  - Linux
  - 技术
comments: true
feature: https://img.isming.me/image/20250305144744698.webp
---

最近淘了一台洋垃圾Chromebook，折腾了一段时间，目前已经基本在日常使用了。在折腾过程中查找了许多的网上资料，解决了不少中文环境使用ChromeOS的问题，这里就分享一下Chromebook的选购和软件安装。
![](https://img.isming.me/image/20250305144744698.webp)

<!--more-->
### ChromeOS是什么
ChromeOS是Google从2009年开始开发的项目，可以简单理解为在Linux内核上运行的，以Chrome浏览器作为桌面环境，主要功能也是运行Web应用程序的一个操作系统。在之后，该系统也支持了运行Android应用程序，以及通过容器运行Linux程序，这样一套组合下来，我们就获得了一个原生支持运行Android应用，Linux应用和Web应用的系统，这比在Windows下面折腾Linux子系统，Android子系统要流畅得多。

目前为止，想要运行ChromeOS有两种方式，第一种就是购买ChromeBook，也就是搭载了ChromeOS的笔记本电脑或者触屏电脑。第二种方式，Google在2022年发布了ChromeOS Flex，让用户可以在经过认证的设备上安装ChromeOS Flex，包括一些Mac电脑也是支持的。

而想要激活ChromeOS，你需要有可以顺畅访问Google服务的网络。如果你没有这个条件，来自中国的fydeOS它是一个本地化的ChromeOS，内置了本地化定制和国内可以使用的网络服务，感兴趣可以去他们的官网看看。

### Chromebook适合谁
ChromeOS最初设计出来也主要是方便云端办公，提供简单、快速、安全的环境，因此它更适合于对于性能没有要求，而希望简单吗体验的人。比如说：使用在线文档的文字工作者，得益于Google doc，飞书文档，语雀等文字和表格类在线工具，Chromebook简单的功能以及比较长的续航是一个性价比比较高的选择。除此之外，对于性能没有要求的开发者和数码极客或许也会考虑由于一台自己的Chromebook。

最新的Chromebook有两档标准，普通的Chromebook，以及Chromebook Plus，普通的Chromebook可能只搭载Intel Celeron处理器以及4GB的ROM， Plus也只是它性能的两到三倍。目前Chromebook在国内没有销售，通过天猫国际等平台平台购买的新机器一般也都比较贵没有性价比。对于普通用户国内平台在销售的平板电脑或者笔记本都比它有性价比的多。

而对于我所说的极客用户来说，在闲鱼淘一台洋垃圾Chromebook可能是一个比较有性价比的选择。比如我这台Lenovo Duet5，骁龙7C，8GB内存，256GB存储，13寸的OLED屏幕，搭配触控笔加键盘，支持平板模式和桌面模式，只要不到1500块钱，相比于iPad，看起来还是有点性价比的。

### Chromebook选购指南
再次强调一下选择Chromebook需要保证有能够激活Google服务的网络环境。不具备的可以考虑fydeos，以及他们的Fydetab Duo设备。

在淘设备的时候，因为我们可能买到的是2019年或者更早发布的设备，我们需要关注设备的自动更新到期时间（简称AUE），所有ChromeOS设备都能够借助于Chrome浏览器几乎同步的更新节奏收到Google的定期更新。因此决定购买之前可以在Google的[这个页面](https://support.google.com/chrome/a/answer/6220366?sjid=14269108156232668775-NA)看一下该产品型号的AUE日期。

其次，电池健康度也是选择二手Chromebook产品时候值得关注的信息。本身购买Chromebook就是为了优秀的能耗和续航体验，电池不行这些就没办法完全达成了。购买前最好和商家沟通让对方打开「关于 ChromeOS > 诊断」界面并提供截图，可以在这个界面中清楚地看到当前设备的电池寿命、循环计数等信息。从这里可以大概预估该设备之前的运行时长，并且电池寿命高于90%应该是比较好的。我在这里就踩到了坑，因为是专门的二手商家，说了是库存设备，并且说没法激活设备不愿意提供截图导致我收到的设备实际上电池已经循环过了300多次，电池寿命只有86%，同时因为运行时间过长oled屏幕也有一点烧屏了。

![](https://img.isming.me/image/20250305145353727.webp)

最后，屏幕这块OLE屏幕可以让卖家把屏幕亮度跳到最低拍照这样也能看到一部分屏幕的缺陷，以及全白页面拍照测试等。关于型号的话，考虑到Android应用的兼容性，我选择的是ARM芯片的Duet设备，如果更加关注Linux应用的兼容性或许可以考虑X86芯片的设备。设备的型号这块，除了我提到的Duet，Google推出的Pixelbook Go， Pixelbook也是可以考虑的型号。

最后的最后，实际购买之前可以考虑使用现有设备刷如ChromeOS Flex或者fydeOS体验一下再做决定。

### ChromeOS 初始化

ChromeOS本身的内核是Linux，但是为了安全，我们是没办法在上面安装Linux应用的，同时Android应用的安装也必须通过Play store才能安装，因此如果想要获得系统的完全控制权是需要开启开发者模式的。开启开发者模式后可以直接安装Android APK文件，同时也拥有了Root权限，可以在系统做修改，比如安装类似Mac下面homebrew的chromebrew工具等。但是代价是，每次启动电脑都会先跳出一个60s的警告页面（可以跳过），而在普通模式和开发者模式之间切换，所有的系统数据都会被清除，需要提前做好备份。

![](https://img.isming.me/image/20250305152618197.webp)


在我体验完开发者模式之后，决定还是回到安全模式。对于大部分人也都不需要开发者模式，我们通过Linux子系统开启Linux子系统的开发者模式，也就可以通过ADB来安装Android应用。因此如果想要开启开发者模式可以查看网上的资料。
初始化，可以通过家庭的软路由，或者手机上面开启Clash作为代理服务，在连接完网络后，修改网络中的代理服务，把手机或者软路由作为Chromebook的代理服务器，从而可以激活服务。同时要系统更新和安装Linux子系统需要稳定的翻墙服务，不然可能会失败。

### ChromeOS初体验
ChromeOS内已经内置了一部分Web应用，包括了Google全家桶和一些工具应用。在未连接键盘鼠标前是平板模式，连接了之后为桌面模式。

![](https://img.isming.me/image/20250305145512742.webp)
<center>以上为桌面模式，打开两个应用平铺，左下角为应用列表。</center>

![](https://img.isming.me/image/20250305145713975.webp)
<center>以上为平板模式的桌面</center>

很多场景也可以通过浏览器进行，对于一些提供了PWA的网站，可以点击地址栏的安装按钮，这样就会生成一个桌面图标方便下次使用。也可以在Chrome应用商店安装扩展程序。

因为登录了Google账号，Chrome浏览器上安装的扩展程序，一些设置，书签等也都会同步过来。

同时ChromeOS还支持与Android手机连接，能够对手机进行简单的控制，包括手机的静音，地理位置权限开关，控制手机的热点并连接上网，查看手机最近的照片，打开的Chrome标签页等，如下图所示。

![](https://img.isming.me/image/20250305150223619.webp)


对于中文输入，Chrome内置了拼音输入法，如果使用双拼的话可以考虑使用fydeos提供的[真文韵输入法](https://chromewebstore.google.com/detail/%E7%9C%9F%E6%96%87%E9%9F%B5%E8%BE%93%E5%85%A5%E6%B3%95/ppgpjbgimfloenilfemmcejiiokelkni?hl=zh-CN)，不过真文韵输入法没有软键盘，在平板模式还是没法使用，另外真文韵在Linux应用也无法使用，解决方法后面再说。

### 配置Linux子系统
Linux系统模式是未开启的，需要首先到「关于 ChromeOS 」中开发者部分开启，最新版本默认安装的是Debian 12，因为需要到Google的服务器上下载Linux镜像文件，这个过程可能非常慢，我这里差不多半个小时才完成。

有了Linux系统，我们首先需要安装中文环境，执行如下命令安装中文字体：
```bash
sudo apt install fonts-wqy-microhei fonts-wqy-zenhei fonts-noto-cjk
```

Linux上面是没法使用系统的输入法的，我们需要安装Linux的中文输入法，我这里就是安装的fcitx5，可以使用如下命令安装：
```bash
sudo apt install zenity fcitx5 fcitx5-rime
```

安装之后在 */etc/environment.d/* 文件中创建一个`im.conf`文件，并且写入如下内容：
```shell
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS=@im=fcitx
SDL_IM_MODULE=fcitx
```
之后手动打开fcitx5，并且配置好自己的输入法选项就可以在Linux中使用应用了。

除此之外，就跟正常使用linux一样，安装的Linux应用如果是有桌面图标的也会在Chrome的应用列表中展示，同样对于deb文件，也可以直接在chrome的文件管理器中直接点击安装。

现在ChromeOS也支持了安装多个容器，也就是说可以运行多个不同的Linux，感兴趣的可以看看这位博主的[这篇安装ArchLinux的文章](https://blog.skihome.xyz/archives/4/)。

### 安装微信
微信算是每个人都必须有的通信工具了，在ChromeOS中有两种方式可以安装，一个是安装到Android子系统，直接在Google play下载就行了，另一种则是安装Linux版本的桌面微信。

但既然有这么大的屏幕，当然是桌面版使用体验更好了。我这里介绍一下在我的Debian12下面安装arm版本的微信的过程吧，因为微信的有一些依赖系统内是没有的组件需要安装。

```shell
sudo apt install libatomic1 -y && wget -O libwebp6.deb https://security.debian.org/pool/updates/main/libw/libwebp/libwebp6_0.6.1-2.1+deb11u2_arm64.deb && sudo dpkg -i libwebp6.deb
```

除了这个之外还缺少一个`libtiff5`，debian12上面已经有libtiff6了，我们创建一个链接就可以了。
```shell
sudo ln -s /usr/lib/aarch64-linux-gnu/libtiff.so.6 /usr/lib/aarch64-linux-gnu/libtiff.so.5
```

之后我们应该就可以使用Linux版本的微信了。

另外还推荐在Linux子系统安装stalonetray，这样就可以展示Linux的软件的托盘，比如去查看输入法状态，和切换输入选项等。可以参考[这篇文章](https://fydeos.com/help/knowledge-base/linux-subsystem/setup/configure-linux-system-tray/)。

对于Linux直接在Chrome点击deb文件安装的应用，虽然安装完了但是有可能点击图标打开的时候总是在转圈却打不开，这可能是因为程序出错了，可以在命令行中手动运行，这样错误日志就可以查看了。

### 配置安装非Google play的Android应用
如果想要安装国内的应用，可能很多都无法在Google play商店下载，一种方式是打开ChromeOS的开发者模式，但是那样每次开机就要忍受开机警告。我这里选择通过Linux子系统来安装。

首先打开「关于 ChromeOS -> Linux开发环境 -> 开发Android应用」，将其中的启用ADB调试打开。

![](https://img.isming.me/image/20250305151245141.webp)

点击启用的时候会有如下提示：

![](https://img.isming.me/image/20250305152713933.webp)

并且如果停用的话也会讲Chromebook回复出厂设置，使用这个功能需要谨慎哦。

再打开Linux命令行，执行如下命令安装adb工具。
```shell
sudo apt install adb
```

之后打开「设置 -> 应用 -> 管理Google Play 偏好设置 -> Android设置」，这样就进入Android系统的设置应用中了，可以在关于设备中多次点击版本号，开启Android子系统的开发者模式，在然后到系统，开发者选项中打开ADB调试。之后在linux命令行执行如下命令并显示正常就说明配置好了。
```shell
adb devices
```

之后就可以通过ADB安装程序了，当然也可以选择使用adb安装一个国内的应用商店，之后通过应用商店安装应用。
### ChromeOS的体验介绍
使用了一段时间之后来说，作为一个轻量化的Linux 本来说，这台设备还是符合期望的。Linux，Android子系统都和宿主系统有着很好的深度绑定，使用子系统的应用也和使用宿主一样有着很好的体验。而在我这里一大缺陷为，因为Linux子系统和Android子系统都被划分到了私有网络，因此它们实际上网络是和Chromeos宿主共享的，但是和局域网的其他设备不是在同一个子网里面的，因此类似LocalSend这种工具是不能使用的。这里目前我的解决办法是使用fydeOS提供的[fyDrop工具](https://drop.fydeos.com/)和其他局域网进行文件传输。

这个设备同时还支持通过usb typec接口连接外接显示器，chromeos有着不错的窗口管理，桌面分屏，这些功能都为使用体验加分许多。

如果只是轻办公我感觉这是一台很棒的设备，但是得益于这个性能，想要在这上面做Android开发，去编译程序那就不敢想象了。而至于要不要入坑，还是要你自己决定。

最后照例来推荐一些可以参考的资料：
1. fydeOS源于chromeOS，这边的中文资料都可以参考：[https://community.fydeos.com/t/topic/40986](https://community.fydeos.com/t/topic/40986)
2. Chrome 官方的文档： [https://chromeos.dev/en/linux](https://chromeos.dev/en/linux)
3. 解锁开发者模式和一些折腾，可以参考这边文章和博主的其他文章： [打造一台适合生产的Chromebook](https://blog.skihome.xyz/archives/5/)