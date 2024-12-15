---
layout: post
title: Linux重装与dotfile整理分享
date: 2024-12-15T20:05:07+0800
tags:
  - 技术
  - Linux
  - Ubuntu
comments: true
feature:
---

最近把电脑上面的Linux系统给重装了，同时呢也要配置新的MacBook，就整理了一个个人的dotfile，这个分享一下linux上的使用的软件，以及我的dotfile内容。

<!--more-->

### 什么是Dotfile

`dotfile`字面意思就是以`.`开头的文件，在Linux当中就是隐藏文件，我们大家说的一般指的就是配置文件，比如shell的`.bashrc`、`.profile`文件等。我在整理自己的`dotfile`的时候参考了一些网上大神的`dotfile`文件，这里我主要是包含我的`shell`的一些配置文件，`vim`、`git`、`rime`相关的文件。

### 我的 Dotfile
为了保持Linux和Mac系统的统一， 我将Linux的Shell也换成了`zsh`，同时为了简单并没有使用`oh-my-zsh`，只是添加了一些自己常用的`aliases`。

而Vim则使用neovim，它相当于是重新开发的，我想比vim应该代码上面更加高效，毕竟少了很多的历史包袱。另外它的配置文件可以使用Lua进行编写，而不是使用vim script，这样也是它的一大优点。

除了配置之外，还增加了脚本用用于将这些配置文件自动拷贝到对应的目录，使用以下代码判断是Linux系统还是Mac系统：
```shell
if  [ "$(uname -s)" == "Darwin"  ]; then
	//action for mac
else
	//action for linux
fi
```

另外呢，对于Mac系统，在初始化脚本中还添加了homebrew的安装，并且通过使用`Brewfile`在定义需要安装的一些软件，这样在执行`brew bundle`的时候可以把这些软件都安装上去。

对于Linux的目前还没做啥，都是通过自己手动安装的，不过一些操作也记录到了shell文件当中了。

### Linux上的软件
既然写了文章，就顺便分享一下我的Linux上面还在用的软件吧。
首先是Shell，为了跟Mac保持统一，也改用了zsh，如果你也想要设置zsh为你的默认shell，可以执行如下命令并重启（前提你已经安装的zsh):
```shell
 sudo chsh -s $(which zsh) $USER
```

编辑器目前在用的有三款，主要在用neovim，同时代码文件还会使用`vscode`，因为有些场景neovim操作比较麻烦（对于快捷键不太熟悉），最近也在使用阮一峰老师之前推荐过的zed，据说比vscode性能更高，目前体验是对于很多语言的支持是已经内置了，不需要在安装插件，这点是好评的。

输入法在使用Fcitx5，输入方案则是使用了Rime，Rime的配置则是参考了雾凇拼音，而我主要使用小鹤双拼。

其他还在使用的软件包括：
项目开发： Android studio
截图软件：Flameshot
启动器： ULauncher， 使用简单，支持的插件数量也比较多
文档搜索： Zeal doc，mac 上面dash的window和linux平台开源版本，支持dash的文档。
文件同步： Syncthing
局域网文件传输： LocalSend
聊天软件： Weixin, telegram
文档和博客编辑： Obsidian
网页浏览器： Edge

### Linux 开启zram
我的电脑已经有32G的内存了，大部分时候是够用的，但是编译Android系统的时候就不够用了。因此需要想办法，一种方式是弄一个swap空间，但是swap的速度不是很快，经过查询资料了解到现在linux已经有了一种新的虚拟内存技术，也就是zram，它主要功能是虚拟内存压缩，它是通过在RAM中压缩设备的分页，避免在磁盘分页，从而提高性能。

而想要启用它其实很简单，在我们的Ubuntu中，只需要首先关闭原先的swap空间，编辑`/etc/fstab`文件，将其中的swapfile条目注释掉。之后调用如下命令：
```shell
sudo swapoff /swapfile
```
如果你本来就没有设置swap，那就不需要做上面的操作，直接安装`zram-config`:
```shell
sudo apt install zram-config
systemctl enable zram-config //设置开机启动开启zram的服务
systemctl start zram-config //启动zram服务
```
之后可以调用如下命令验证：
```shell
cat /proc/swaps
```
我们在系统监控里面也能看到，不过还是swap。
以上方式开启的zram为物理内存的一半大小，当然也是可以修改的。
修改`/usr/bin/init-zram-swapping`文件中的mem大小即可。

如果对于我的dotfile感兴趣，可以查看我的repo， 地址为： [https://github.com/sangmingming/dotfiles](https://github.com/sangmingming/dotfiles),其中我提到的初始化脚本为`script/bootstrap`文件。