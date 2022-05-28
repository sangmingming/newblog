---
layout: post
title: "2022年在MacOs上编译AOSP"
date: 2022-05-17 22:30:52 +0800
comments: true
---

之前苦于电脑磁盘空间比较小，而android系统的源码越来越大，一直没有机会自己编译Android系统。这次换了电脑，磁盘足够大，可以尝试一下了。
而android源码的网站红色的字写着 *Platform development on MacOS isn't supported as of June 22, 2021.* ，我就知道不会那么容易了。

<!--more-->
我的电脑环境：

> 2021款  M1芯片 Macbook Pro 16GB运行内存
> MacOS Monterey(12.1)

## 环境准备
### 安装xcode和相关工具
+ 从appstore安装Xcode
+ 安装xcode command line tools：

> $ xcode-select --install

+ 安装Rosetta（M1芯片需要，x86芯片不需要）

> $ softwareupdate --install-rosetta

### 创建大小写敏感的磁盘映像
我们先创建个350GB的大小

> $ hdiutil create -type SPARSE -fs 'Case-sensitive Journaled HFS+' -size 350g ~/forest.dmg

### 设置环境变量
我本地用的zsh，直接在.zsh_env中写，并配置挂载映像的方法

```shell
#  设置最大打开文件数量，防止编译过程中因为打开文件数量太多失败
ulimit -S -n 2048
# 编译缓存
export USE_CCACHE=1
# 挂载映像
function mountForest { hdiutil attach ~/forest.dmg.sparseimage -mountpoint /Volumes/Forest; }
#卸下挂载
function umountForest() { hdiutil detach /Volumes/Forest; }
export PATH="/opt/local/bin:/opt/local/sbin:$PATH"
export PATH=~/.bin:$PATH
```
编辑完保存之后，执行一下如下语句使配置当前就能生效
`source ~/.zshenv` 

## 下载源码
```shell
$ mkdir ~/.bin
$ curl https://storage.googleapis.com/git-repo-downloads/repo > ~/.bin/repo #下载repo
$ chmod a+x ~/.bin/repo #设置repo权限
$ mountForest #挂载映像
$ cd /Volumes/Forest
$ mkdir aosp_mata
$ cd aosp_mata
$ git config --global user.name "Your Name"
$ git config --global user.email "you@example.com" 

$ repo init -u https://android.googlesource.com/platform/manifest -b android-11.0.0_r48 #可自选版本，我这用的是11.0.0的最后一个tag
$ repo sync
```

之后便是无尽的等待去下载源码，国内的网络下载不了，自己想办法爬墙吧。

## 开始编译
如果没有问题，在源码目录直接执行以下命令就可以编译了
```shell
$ source build/envsetup.sh
$ lunch aosp_arm-eng
$ make -j4
```

lunch后面的参数也可以不填，则会显示出来所有可以的选项，自己选一个进行设置就行。
make就开始编译， -jN用于设置任务数， N应该介于计算机上的CPU线程数的1-2倍之间为宜，我的M1 MAC 是10核，就先设置了24。

理论上这样就可以慢慢的等就能编译成功了，然而，如果可以这么简单就不需要我写一篇文章了，直接看android官方文档就行了。为了节省时间，先把下面的问题改改再编译。

## 问题解决
#### 问题一：Could not find a supported mac sdk
大概是这样的log
```shell
[ 94% 171/181] test android/soong/cc
FAILED: out/soong/.bootstrap/soong-cc/test/test.passed
out/soong/.bootstrap/bin/gotestrunner -p ./build/soong/cc -f out/soong/.bootstrap/soong-cc/test/test.passed 
-- out/soong/.bootstrap/soong-cc/test/test -test.short
--- FAIL: TestDefaults (10.86s)
    cc_test.go:3075: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
    cc_test.go:3075: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
    cc_test.go:3075: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
    cc_test.go:3075: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
    cc_test.go:3075: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
    cc_test.go:3075: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
--- FAIL: TestDoubleLoadbleDep (0.05s)
    cc_test.go:733: "Could not find a supported mac sdk: [\"10.10\" \"10.11\" \"10.12\" \"10.13\" \"10.14\" \"10.15\"]"
..... ....
```
原因是指不到指定的mac sdk
可以看一下`/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs`文件下有没有 *MacOSX12.3.sdk* ， 然后在然后在 */build/soong/cc/config/x86_darwin_host.go* 文件中找到 “darwinSupportedSdkVersions“ 添加 MacOSX12.3.sdk 对应的版本号——12.3，如果你的macosx的sdk是别的就填别的。
```
darwinSupportedSdkVersions = []string{
		"10.10",
		"10.11",
		"10.12",
		"10.13",
		"10.14",
		"10.15",
		"12.3",
}
```

另外你也可以到[https://github.com/phracker/MacOSX-SDKs/releases](https://github.com/phracker/MacOSX-SDKs/releases) 去下载10.15的sdk放到上面的文件夹里面。

#### 问题二： v8引擎无法编译，一些文件找不到
由于2021年后，官方不维护mac上的开发环境了，所以external/v8下面有很多编译错误，这里直接采用回滚代码的方式，我是回滚到了 *Upgrade V8 to 8.8.278.14*提交的前一个Commit
```shell
cd external/v8
git checkout 9304fbb
```


#### 问题三： undeclared identifier ‘PAGE_SIZE’
```shell
system/core/base/cmsg.cpp:36:21: error: use of undeclared identifier 'PAGE_SIZE'
  if (cmsg_space >= PAGE_SIZE) {
                    ^
system/core/base/cmsg.cpp:78:21: error: use of undeclared identifier 'PAGE_SIZE'
  if (cmsg_space >= PAGE_SIZE) {
                    ^
```
看起来是PAGE_SIZE这个常量没定义，那就去补上呗。去 *system/core/base/cmsg.cpp*文件开头添加 PAGE_SIZE 的声明
```c
#ifndef PAGE_SIZE
#define PAGE_SIZE (size_t)(sysconf(_SC_PAGESIZE))
#endif
```

#### 问题四： incompatible pointer types passing ‘unsigned long *’ to parameter of type ‘uint32_t *‘
```
external/python/cpython2/Modules/getpath.c:414:50: error: incompatible pointer types passing 'unsigned long *' to parameter of type 'uint32_t *' (aka 'unsigned int *') [-Werror,-Wincompatible-pointer-types]
else if(0 == _NSGetExecutablePath(progpath, &nsexeclength) && progpath[0] == SEP)
```
把 *external/python/cpython2/Modules/getpath.c*中：
```c
#ifdef __APPLE__
#if MAC_OS_X_VERSION_MAX_ALLOWED >= MAC_OS_X_VERSION_10_4
    uint32_t nsexeclength = MAXPATHLEN;
#else
    unsigned long nsexeclength = MAXPATHLEN;
#endif
#endif
```
改成：
```c
#ifdef __APPLE__
    uint32_t nsexeclength = MAXPATHLEN;
#endif
```

把 *external/python/cpython3/Modules/getpath.c*中的：
```c
#ifdef __APPLE__
char execpath[MAXPATHLEN + 1];
#if MAC_OS_X_VERSION_MAX_ALLOWED >= MAC_OS_X_VERSION_10_4
    uint32_t nsexeclength = Py_ARRAY_LENGTH(execpath) - 1;
#else
    unsigned long  nsexeclength = Py_ARRAY_LENGTH(execpath) - 1;
#endif
#endif
```

改成：

```c
#ifdef __APPLE__
char execpath[MAXPATHLEN + 1];
uint32_t nsexeclength = Py_ARRAY_LENGTH(execpath) - 1;
#endif
```

以上问题改完应该就可以编译成功了，如果是在后面java编译阶段失败，可以先试试重新执行make试试，如果还是不行的话就上网找解决方案吧。


## 编译idegen模块导入Android Studio
使用如下命令编译idegen模块：

```shell
mmm development/tools/idegen/
```

完成之后，执行如下命令：
```shell
development/tools/idegen/idegen.sh
```
之后就会在根目录生成对应的 `android.ipr`、 `android.iml` IEDA工程配置文件,之后在IDEA或者Android Studio中打开android.ipr就能浏览源码了。


## 参考
参考了以下资料和网友的分享，非常感谢：

+ [https://source.android.com/setup/build/building]()

+ [https://nf4789.medium.com/building-android-11-for-ph-1-on-apple-silicon-6600436a36a0](https://nf4789.medium.com/building-android-11-for-ph-1-on-apple-silicon-6600436a36a0)

+ [https://51wlb.top/aosp/](https://51wlb.top/aosp/)