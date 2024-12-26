---
layout: post
title: 强大的壳-Shell Script
date: 2024-12-26T13:45:07+0800
tags:
  - 技术
  - Linux
comments: true
feature:
---

Shell脚本我们经常会使用，平时自己折腾Nas会用到，工作中为了配置CI会用到，自己的电脑上最近为了配置自己的命令行环境也要使用shell来进行配置。不过之前的shell功力都来自每次使用的时候网上搜索，于是最近就找了一本《Linux命令行与shell脚本编程大全》看了看，看完之后更加感受到Shell的强大，特地写个文章来分享一下。

![](https://img.isming.me/image/linux-shell.jpeg)
<!--more-->

首先呢，shell它也是一种语言，不过因为使用到的shell环境不同语法会有一些差异，在Linux上我们常用的shell是Bash，在Mac上面常用的shell为zsh，大体的语法相似的。编程语言的基本要素，Shell都是支持的，它支持变量，支持if判断，case选择，循环等结构化的编程逻辑控制，也支持基本的算数运算，同时还支持使用函数来复用代码。
简单介绍一下它的语法，首先是变量。系统为我们已经提供了很多的变量，同时在我们的配置文件中定义的那些变量也是可以读取到的。定义变量语法如下：
```bash
var=value #注意等号两边不能加空格
echo $var #使用的时候前面要加上$符号
echo ${var}

export varb=b #导出成为环境变量
```
以上方式定义的变量默认是全局的，比如你在一个函数中定义的，外面也能访问，这是时候可以定义局部变量：
```bash
local local_var=x #只能在函数中使用
```
除了普通的变量之外，shell中也是支持数组和Map的，当然要bash 4.0以上才能完整支持，使用如下：
```bash
declare -A info # 声明一个map
declare -a array #声明一个数组
```

而如果只是有这些东西的话，还不至于说Shell强大。而shell中可以直接调用命令以及Linux中的一些程序这才是它的强大之处。在python等其他语言中我们也是可以调用的，但是是都需要通过语言的系统调用才能调用，而shell中则是可以直接调用那些命令，只要这些程序的可执行文件在PATH环境变量中就可以。

而配合Shell的很多特性，又进一步强大了。第一大神器是重定向，重定向支持重定向输入和重定向输出，以下为一些示例：
```bash
date > test.txt #重定向输出到test.txt文件中，覆盖文件
ls >> test.txt #重定向，但是追加而不是覆盖文件
wc < test.txt #输入重定向
wc << EOF      #内敛输入重定向
test a
test b
EOF
```
因为有了输入输出重定向，我们会有很多的玩法，可以方便的命令的输入写入到我们的文件中，而linux系统中，万物皆为文件，因此理论上可以写入或者读取所有东西。比如，有一个Null设备，我们可以通过以下的命令，来不展示任何运行输出。
```bash 
ls >/dev/null 2>&1
ls 1>/dev/null 2>/dev/null
```
1为标准输出，2为错误输出，未指定的时候默认是把标准输出重定向，这里重定向到null则不会有任何输出，而第一行我们将错误输出又通过&绑定到了标准输出。当然除了这个还有更多的用法。

除了重定向之外的另一大特性则是 *管道* 。在某些场景重定向已经可以解决了很多功能，但是管道实现会更优雅。管道可以将前一个命令的输出直接传给另一个命令，并且管道的串联没有数量的限制，并且前一个命令产生输出就会传递到第二个命令，不用使用缓冲区或者文件。比如：
```bash
ls | sort | more
```

甚至我们还可以将刚刚的输出继续重定向保存到文件
```bash
ls | sort > files.txt
```

在很多命令的参数之类的都提供了正则表达式的支持，正则表达式能够让我们更加方便的进行数据匹配，Linux中常用正则为POSIX正则表达式,而它又有两种，基础正则表达式（BRE）和扩展正则表达式（ERE)，大部分的Linux/Unix工具都支持BRE引擎规范，仅仅通过BRE就能完成大部分的文本过滤了，但是ERE提供了更强的功能，而有些工具为了速度，也仅仅实现了BRE的部分功能。

BRE支持的语法符号包括，`.`匹配任意一个字符，`[]`字符集匹配，`[^]`字符集否定匹配，`^`匹配开始位置， `$`匹配结束位置，`()`子表达式，`*`任意次数量匹配(0次或多次)，而ERE在BRE的基础上，还支持`?`最多一次匹配，`+`匹配至少一次。而它们的更多功能可以参看这篇文章：[https://en.wikibooks.org/wiki/Regular_Expressions/POSIX_Basic_Regular_Expressions](https://en.wikibooks.org/wiki/Regular_Expressions/POSIX_Basic_Regular_Expressions)。

有了正则表达式以及许多的处理工具我们就可以做很多的事情了，比如说查找文件，我们可以使用`find`，查找某个文件夹下面为指定后缀的文件：
```bash
find . -type f -name "*.java" #find支持的只是通配符，非正则
```
而配合管道，又可以对find之后的结果进行进一步的处理，比如配合上`grep`可以进一步对文件的内容进行过滤。
```bash
find . -type f -name "*.sh" |xargs grep "bash" #find 不能通过管道直接传递可以使用xargs或者通过如下方式
find . -type f -name "*.sh" -exec grep "bash" {} \;
```

对于文本的处理，Linux中又有sed和awk两大杀器，而关于他们的使用已经可以被写成书了。sed全名为Stream editor，也就是流编辑器，通过它可以方便的查找文件内容并替换后输出，awk则是一种模式匹配和文字处理语言，通过他们可以方便的处理文本。比如说我们可以使用sed对一份CSV文件中的手机号码进行打码处理：
```bash
sed -E 's/([0-9]{3})[0-9]{4}([0-9]{4})/\1**\2/g' input.csv
```

以上关于命令的介绍只是抛砖引玉，关于他们的使用，我们的电脑中已经给我们提供了详细的介绍，只需要在命令行中输入`man commandname`就可以了，除此之外，很多的命令也也提供了简单的帮助，只需要输入`commandname help`, `command --help`之类的就可以看到。


如果仅仅是语言层面的功能的话，shell相比python是没什么优势的，但是它能够和其他的命令无缝的使用，并且被Mac，Linux，Unix内置可直接使用也是它的一大优势。此外我们还可以通过shell脚本来增强我们的Linux终端，比如说可以定义自己的函数，通过`.bashrc`引用，可以在终端中直接调用方法名执行。

通过Shell，在Linux下面的体验得到很好的提升，工作效率也可以获得很大的提高，本文只是略微提到其皮毛，希望能够引起你对Shell的兴趣，如果想要更加深入的了解，还是需要去阅读手册或者书籍。

以下是推荐的一些资料可供参考：
1. [Bash脚本编程入门 by阮一峰](https://wangdoc.com/bash/)
2. [Bash脚本进阶指南](https://linuxstory.gitbook.io/advanced-bash-scripting-guide-in-chinese)
3. [Grep,Sek和awk的区别](https://www.baeldung.com/linux/grep-sed-awk-differences)
4. 《Linux命令行与Shell脚本编程大全》（可以在微信读书中看电子书）
5. [awesome-shell](https://github.com/alebcay/awesome-shell) (值得看看的各种资料，也可以去看看别人写的shell脚本)