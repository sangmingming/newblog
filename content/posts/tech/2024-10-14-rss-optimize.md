---
layout: post
title: "更优雅的RSS使用指南"
date: 2024-10-14T21:32:37+0800
tags: ["RSS", "技术", "折腾"]
comments: true
feature: 
---

最近因为Follow的爆火，RSS的内容也跟着一起火了一把。笔者最近也优化了一下自己博客的RSS输出，在这里写一下博客如何更加 优雅的输出RSS，以及在订阅RSS的时候如何更好的发现RSS源。

<!--more-->

### RSS2.0 与 ATOM

[RSS](https://en.wikipedia.org/wiki/RSS)是一种消息来源格式，用于方便的将一个站点的内容以一个指定的格式输出，方便订阅者聚合多个站点的内容。

目前RSS的版本为2.0，而我们大家在使用博客输出RSS文件的时候，除了常用的RSS2.0格式，目前还有一个`ATOM`格式，其目前的版本为`1.0`。Atom发展的动机为了解决RSS2.0的问题，它解决了如下问题（[来源WikiPedia](https://zh.wikipedia.org/wiki/Atom_(%E6%A8%99%E6%BA%96))）：
> - RSS 2.0可能包含文本或经过编码的HTML内容，同时却没有提供明确的区分办法；相比之下，Atom则提供了明确的标签（也就是typed）。
> - RSS 2.0的description标签可以包含全文或摘要（尽管该标签的英文含义为描述或摘要）。Atom则分别提供了summary和content标签，用以区分摘要和内容，同时Atom允许在summary中添加非文本内容。
>- RSS 2.0存在多种非标准形式的应用，而Atom具有统一的标准，这便于内容的聚合和发现。
>- Atom有符合XML标准的命名空间，RSS 2.0却没有。
>- Atom通过XML内置的xml:base标签来指示相对地址URI，RSS2.0则无相应的机制区分相对地址和绝对地址。
>- Atom通过XML内置的xml:lang，而RSS采用自己的language标签。
>- Atom强制为每个条目设定唯一的ID，这将便于内容的跟踪和更新。
>- Atom 1.0允许条目单独成为文档，RSS 2.0则只支持完整的种子文档，这可能产生不必要的复杂性和带宽消耗。
>- Atom按照RFC3339标准表示时间 ，而RSS2.0中没有指定统一的时间格式。
>- Atom 1.0具有在IANA注册了的MIME类型，而RSS 2.0所使用的application/rss+xml并未注册。
>- Atom 1.0标准包括一个XML schema，RSS 2.0却没有。
>- Atom是IETF组织标准化程序下的一个开放的发展中标准，RSS 2.0则不属于任何标准化组织，而且它不是开放版权的。

相比之下ATOM协议是有更多的有点，如果你RSS生成程序已经支持了Atom那肯定是优先使用Atom。不过现在基本上99%以上的Rss订阅器或者工具对于两者都有很好的支持，因此如果你现在已经使用了RSS2.0也没必要替换成Atom了。

### RSS的自动发现
对于提供Rss订阅的网站，最好的方式是提供相应的连接或者使用Rss图标，告诉访客当前网站的Rss地址。


除了这样之外，我们还应该在网站的源码中添加RSS地址，这样对于一些浏览器插件或者订阅软件可以通过我们的网站页面自动发现RSS订阅地址。

对于RSS2.0的订阅地址可以添加如下代码：
```html
<link rel="alternate" type="application/rss+xml" href="/feed.xml" />
```

对于ATOM的订阅地址可以添加如下代码：
```html
<link rel="alternate" type="application/atom+xml" href="atom.xml" title="Site title" />
```

如果你同时提供了ATOM和RSS2.0两种订阅文件，可以上面两行代码都添加。当然现在一些博客程序的模板文件中已经添加了上面的代码，检查一下即可。

### RSS输出的优化
因为我的博客是以RSS2.0格式输出的订阅文件，因此这里我就按照我的优化内容来介绍一下输出相关的优化，对于ATtom可以参考其规范文档。

首先区分介绍和全文的输出。对于只输出描述的网站只需要设置描述部分即可，对于输出了全部的博客，还是建议同时输出描述和全文的。  ~~而RSS2.0不支持输出全文，我们可以用一下的标记来输出全文：~~
```xml
<content:encoded>全文内容</content:encoded>
```
~~其中的文章html，最好做一下转码。~~ （以上代码加的有问题，有的RSS识别失败，暂时回退了，有时间换Atom）



其次可以补充一下网站的内容的元数据，比如作者的信息，网站的标题简介等等。

对于文章，也可以在输出的时候输出相关的元数据，如标题，作者，标签等。标签支持设置多个，可以用如下的标记：
```xml
<category domain="{{ .Permalink }}">{{ .LinkTitle }}</category>
```

另外在我设置的过程，发现rss是提供了一个`comments`标记的，设置这个标记后，如果RSS阅读器对此支持，理论上可以直接从RSS阅读器点击跳转到文章的评论页面。

最后，我们可能想要检测要多少通过RSS点击跳转到我们博客的访问量，这个时候可以在输出的链接上面加上特定的参数，这样在我们的统计平台上面就可以看到有多少用户从这里打开页面的，我所加的参数如下：
```
?utm_source=rss
```

### 订阅RSS
目前最流行的订阅RSS的方式要属于Follow了，这里也推荐使用。

除了Follow之外，我还自建了一个FreshRss来订阅一些内容，这个的使用要更早于Follow的出现。现在还不能抛弃它的原因是Follow目前不支持移动端，我使用Android的手机，在移动推荐使用`FeedMe`来浏览FreshRss的订阅内容。

另外，我们在浏览一些内容或者博客的时候，也需要一个工具来帮助我们方便的查看和订阅RSS源，这个时候就要推荐一下DIYgod大佬开发的浏览器插件[RSSHub-Radar](https://github.com/DIYgod/RSSHub-Radar)，对于我们的博客，如果已经加了我前面说的html代码，它可以自己发现订阅地址，如下图所示：
![](https://img.isming.me/image/rsshub-radar-blog.png)


它还支持配置规则，则一些拥有RSSHub订阅的站点，比如b站，微博，小红书等，可以嗅探到RSShub的订阅地址，如下图所示：
![](https://img.isming.me/image/rsshub-radar-bilibili.png)

另外，看上面弹出的窗口中是可以直接去预览对应的RSS内的，还可以直接跳转到Follow、FreshRss等订阅源去添加这个订阅源，这些可以在插件的设置中进行设置，如下图所示：
![](https://img.isming.me/image/rsshub-radar-setting.png)

除了上面的设置，这个插件还支持一些其他的设置，读者朋友可以自行探索。


### 总结
以上就是关于网站配置和rss订阅方面我的一些建议，而本文的标题也有一些标题党了，欢迎吐槽。

### 资料

如果读者需要查阅ATOM和RSS的维基百科，请查看英文版本，中文版本内容比较简略，很多发展相关的内容都没有。
+ ATOM 规范：[https://datatracker.ietf.org/doc/html/rfc4287](https://datatracker.ietf.org/doc/html/rfc4287)
+  RSS2.0 协议：[https://www.rssboard.org/rss-specification](https://www.rssboard.org/rss-specification) 
+ RSSHub-Radar: [https://github.com/DIYgod/RSSHub-Radar](https://github.com/DIYgod/RSSHub-Radar)