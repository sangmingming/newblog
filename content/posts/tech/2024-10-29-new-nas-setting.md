---
layout: post
title: "威联通NAS购入初体验以及设置记录"
date: 2024-10-29T21:57:17+0800
tags: ["技术", "Linux", "折腾", "NAS"]
comments: true
feature: 
---

之前是用树莓派连个两盘位硬盘盒运行一些服务，由于它的稳定性加上容量不够，一直想弄一个NAS，趁着双十一到来，就入手了威联通的NAS，本文介绍 一下购入的抉择以及NAS的初始化和相关的设置。
![](https://img.isming.me/image/ts464c2.png)


<!--more-->

### 缘起
NAS这个东西知道了很多年了，一直想要搞一个，迫于家里花费的紧张，之前一直是使用一台树莓派4B，其中刷了Openwrt系统，挂载了两块盘的硬盘盒，其中开启了Webdav， Samba，Jellyfin相关的东西。不过因为Jellyfin挂载阿里云盘速度不太理想，有不少视频还是下载到自己的硬盘里面的。同时内，硬盘也出现了拷贝大文件就出现问题，需要重启硬盘盒和系统的问题，这个后续会继续说。

DIY NAS硬件或者成品的NAS也关注了有挺长一段时间，迫于以上问题，以及文件越来越多，当时买的这两块2T的硬盘，容量已经不够用了，想要购买一个NAS的想法更加加强，终于决定今年双十一搞个NAS。

### 剁手
购买NAS是有两个选择，自己组装硬件，安装飞牛或者黑群晖等NAS系统，又或者购买群晖、威联通等成品NAS。在V2EX发帖求助，以及自己的纠结中，最终在性价比和稳定性等各种因素比较之后，选择入手了威联通TS464C2。

威联通的系统虽然被大家诟病许久，但是它也算是市场上除了群晖之外NAS系统做的最久的厂家了，考虑到文件的安全可靠在文件系统和系统稳定性上面，这两家还是要比国内的新起之辈更加值得信赖的。而我选择的这一款，支持内存扩展，如果以后服务比较多，可以再增加一根内存。4个3.5寸硬盘位加上两个NVME 硬盘位，对于容量的扩展应该很多年都不存在问题了。双十一这块机器只要2000块钱就拿下，而群晖同配置的4盘位差不多要四千，只能说高攀不起。

另外下单了一块国产的NVME 2T硬盘，加入Qtier存储池，希望能提高一些速度。为了拥有更大的容量，经过一些研究，淘宝购入了一块2手服务器硬盘，型号为HC550， 16TB，回来看Smart信息，已经运行了786天，不过其他信息看着都不错。
![](https://img.isming.me/image/nas-hdd-smart.png)

### 上电
收到机器，插上硬盘，参照指南开始初始化。威联通提供了比较友好的初始化方法，可以通过网页或者应用对它进行初始化，不过一定要插上硬盘才能开始这一切。

根据指南初始化之后，开始了硬盘的初始化和存储池的设置。之前使用的openwrt中对于硬盘的管理是比较简单的，基本就是实现了基础的Linux功能，把磁盘挂载到指定的目录，硬盘初始化之类的。而QNAP中，“存储与快照总管应用”中，对于硬盘和存储卷的设置则全面，可以设置各种raid的存储池，Qtier，快照，卷等等，也有硬盘的运行情况的显示。我想这就是选择大厂成品NAS的原因，毕竟docker之类的东西大家都很容易做，但是这种积累了很多年的东西不是那么快能够做出来的。
![](https://img.isming.me/image/disk-manager-storage.png)


### 安装软件
在威联通NAS中安装软件可以选择从QNAP的应用中心安装应用，也可以安装Container Station之后通过docker来安装。不过官方的应用中心中的应用中主要是一些官方提供的应用，这个时候我们可以选择第三方的应用中心，这里我推荐一个： [https://www.myqnap.org/repo.xml](https://www.myqnap.org/repo.xml)，官方应用商店没有的可以来这里试试。不过这个应用商店中的部分应用是收费的，比如Jellyfin，它提供的版本需要依赖Apache，这个时候你需要去它的网站上面购买，价格还不便宜，当然我是不会去购买的。

除了应用中心安装之外，我们还可以去网上找QPKG文件，比如Jellyfin，我就是使用的`pdulvp`为QNAP定制的版本，下载地址在：[https://github.com/pdulvp/jellyfin-qnap/releases](https://github.com/pdulvp/jellyfin-qnap/releases)。Jellyfin我不使用官方的docker版本有两个原因，一是使用这个定制版本，可以方便的使用英特尔的集成显卡进行视频的硬解，另一方面是使用docker的化，默认只能映射一个媒体目录到Docker中，想要映射多个目录会麻烦一点，因此使用QPKG更方便。

对于其他的应用，比如FreshRss， VaultWarden则是选择了使用Docker进行部署，Container Station的Docker部署为先写一个compose文件，之后软件会帮助下载相关的容器进行启动，这个有个问题就是创建完compose之后，容器启动起来之后，在web界面上就没法编辑compose文件了，想要编辑的需要用ssh进终端去看，比如我创建的`app-freshrss`它的compose文件就在`/share/Container/container-station-data/application/app-freshrss`当中。

![](https://img.isming.me/image/qnap-screenshot.png)

另外威联通自带的一些应用，文件管理，QuMagie，特别要说一下QuMagie，它已经可以帮我把相片按照人物，地点，物品等等分类好了，配合上手机App使用流畅很多，再也不用之前那样使用SMB手动同步了。

### 其他
目前用了这个二手服务其硬盘加上新买的固态硬盘组了一个Qtier池作为主要存储区，家里有块旧的sata固态硬盘就把他搞成高速缓存加速了。原来的两块酷狼硬盘都是EXT4格式，但是插到QNAP上却不能识别，只好放在原来的设备上，新NAS通过Samba访问原先的设备，把文件拷贝过来。

之后把旧的硬盘插上来使用才发现，其中一个硬盘出现了坏道，数量还不少，感觉它应该命不久矣，不敢放什么东西上来了。 而另一块好的硬盘，准备把它作为备份盘，相片，笔记和其他的一些重要文件都定期备份到这个盘上面。因为硬盘数量优先，并没有组RAID还是空间优先，只把重要的文件备份但愿以后不会踩坑。

以上就是这个新NAS的初体验了，后面还要继续增加新的应用，仍然需要摸索，外网访问仍然沿用家里的DDNS和端口转发。目前才用了不到一个星期，还有很多东西没有用到没有涉及，后面有新的体验来再继续写文章分享，也欢迎玩NAS网友一起交流分享，如果有好玩的应用也欢迎评论推荐给我。