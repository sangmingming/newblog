---
layout: post
title: "记录博客转HTTPS"
date: 2017-07-12 21:30:52 +0800
comments: true
---

越来越多的网站已经支持https了，谷歌浏览器对于未使用https的网站会提示不安全。本站采用hexo来静态生成页面，之前托管在github pages上面，因为一直也没有弄。周末在家闲来无事，顺便就把博客改到vps上面，然后添加了https支持。

<!--more-->

### 博客推送到vps
原先博客是推送到github pages的，其实就是传到github的仓库，要迁移到vps，其实也比较简单，在vps上面创建一个git仓库，把代码推到这个git仓库，然后在vps上启动nginx就可以了。具体真可以参考网上的文章：https://www.qcloud.com/community/article/241080001487926962添加对于HTTPS的支持nginx服务器已经支持https了，目前也很成熟了，我们可以使用免费的let’s Encrypt，国内又拍云，七牛都支持申请，但是他们审核什么的还需要时间，所以我们还是直接使用官方方式最好最快了。 Let’s Encrypt官网有详细的介绍，对于不同的系统，不同的网站服务器都有详细的指南。我这里只介绍一下基于ubuntu 16.04,nginx的安装过程。 签名的自动什么和安装是通过Certbot来执行的，我们需要安装certbot的源和软件。

    $ sudo apt-get update
    $ sudo apt-get install software-properties-common
    $ sudo add-apt-repository ppa:certbot/certbot
    $ sudo apt-get update
    $ sudo apt-get install python-certbot-nginx

然后再执行
    sudo certbot --nginx

就可以了。在执行这个命令之后，会有一些提示，首先会提示输入邮箱地址，之后会读取nginx配置读取到域名然你选择，之后就会安装成功了。并且会自动重启nginx使https生效。 我们可以查看网站的nginx配置文件，一般在/etc/nginx/下面，暂时我的服务器上面只有一个网站因此使用默认的就好，是在 */etc/nginx/site-available/default* 文件，可以看到certbot给我添加了如下内容：

        listen 443 ssl; # managed by Certbot
        ssl_certificate /etc/letsencrypt/live/isming.me/fullchain.pem; # managed by Certbot
        ssl_certificate_key /etc/letsencrypt/live/isming.me/privkey.pem; # managed by Certbot
        include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
        if ($scheme != "https") {
            return 301 https://$host$request_uri;
        } # managed by Certbot
    
第一句表示监听443端口，因为https默认端口是443，第二句第三句是签名的key（公钥和私钥），第四句是配置，支持哪些加密方式啊，哪些ssl的协议啊，具体可以自己去看文件。 下面判断是否为https，如果不是就重定向到https，这个也是在certbot在安装的时候会让你选择的，如果选择easy模式则没有这个，选择security模式则有。 另外，Let’s Encrypt的签名有效期只有90天，要记得在签名到期之前重新申请。certbot工具支持更新签名，调用以下命令即可：
    
        sudo certbot renew

同时我们可以自己配置cronjob来定时更新签名。 以上可以看到支持https，越来越简单了。 涉及到其他系统请查看官方文档：https://letsencrypt.org/getting-started/