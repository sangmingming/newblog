---
layout: post
title: "我的个人密码存储与管理"
date: 2024-04-08T19:13:24+0800
tag: [技术杂谈]
comments: true
feature: 
---

作为一个网民，使用每个服务都需要注册账号，而注册账号就需要设置用户名和密码。在早期，我会将所有的密码都设置成相同的，这样方便自己记忆，每次输入密码也都很方便。
![](https://img.isming.me/photo/keepass.svg)

<!--more-->

很久之前的一个同事，他会将自己的所有密码都记在一个小本本上。彼时，一些使用iPhone的朋友已经开始使用1Password来存储自己的密码了。而我，作为一个坚定的Android用户，此时还没有使用过任何的密码管理软件的。

直到某一天，Chrome提醒我我的密码已经泄露不安全了。此时便开始研究适合我的密码管理软件。
最终选择了Keepass作为我的密码管理软件。

经过几年的使用，使用的软件终于稳定下来了，在此分享一下。

目前我需要查看软件的平台有三个Mac 电脑， Windows台式机，以及我的Android手机。
Android手机我使用的是：[Keepass2Android](https://play.google.com/store/apps/details?id=keepass2android.keepass2android) ,windows和mac下使用的是 [KeePassXC](https://keepassxc.org/download/#windows)。密码库是一个kepass文件，可以理解为一个加密数据库，必须通过主密钥才能打开。客户端本身不提供密码的多平台同步功能，我本人使用了坚果云来存储kepass文件，Android手机上keepass2Android通过webdav访问和同步密码库， 电脑上使用坚果云的客户端来同步密码文件。

密码管理工具首先能满足的功能就是创建密码，三个平台的客户端都能自动的生成密码，并且允许配置密码的字符，长度，密码安全等级检查，软件也支持过滤弱密码。

一个做的比较差的密码管理工具，是需要用户在每次输入密码的时候都打开密码管理工具，来复制密码回去再进行粘贴的。这方面1Password做的是最好的，有很多的自动输入或者选择来提高易用性。kepass的客户端当然也是有的。

Android客户端首先是支持Android系统的自动填充服务的，Android 8.0以后的手机就支持，需要在系统设置中设置自动填充服务为Keepass2Android，同时密码保存的时候要保存当前这个应用的package name这样才能自动填充对应的密码。当然也可以先搜索到这个密码后，软件会保存package name，下一次就可以自动选中这一条密码了。对于不支持自动填充服务的手机，或者应用开发者关闭了自动填充，也可以输入的时候把输入法切换为keepass2Android（前提需要在系统的输入法中启用keepass2Android的输入法）。

对于电脑上面，可以通过浏览器插件来实现密码的自动填充，目前edge，firefox，chrome都有对应的插件，可以在上面的链接中找到。对于网页的自动填充，还需要在创建密码的时候，把网址填到密码信息中。

国内的大部分账号目前都是短信验证码登录，用不到密码。另外一些银行或者金融类的限制了自动填充，甚至自己写了个键盘，还是只能切到密码管理器去看密码再回来手动输入进来，短期内也不会有所改善。


总体来说，目前大部分的重要密码都保存到了keepass中，文件也是自己管理，比1password这种托管的更放心一点。目前海外已经开始使用passkey来替代密码，相信未来密码的使用会越来越少。