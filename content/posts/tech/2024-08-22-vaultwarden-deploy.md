---
layout: post
title: "在家搭建VaultWarden密码管理服务"
date: 2024-08-22T19:33:25+0800
tags: ["技术", "技术杂谈", "密码管理", "折腾"]
comments: true
feature: 
---

每个人都有很多密码，有人用脑记，有人用纸记，也有很多的工具帮我们记。之前我一直使用Keepass，在[之前的文章](https://isming.me/2024-04-08-passwords-manage/)介绍过。平时输入密码的场景最多的是网页中，目前keepass的网页插件只能说是能用的程度。前段时间给openwrt上面装上了docker，也想着在家搭一个密码管理服务，于是说干就干了。
![](https://img.isming.me/image/vault-cover.jpg)
<!--more-->

密码服务能够个人搭建的就是Bitwarden了，因为在自家的树莓派上运行，因此选择了基于Rust的VaultWarden，毕竟资源消耗更少，性能也会更好点吧，它兼容Bitwarden，因此所有的客户端和浏览器插件都通用。
因为是在家里搭建要保证在外的时候，密码服务也能正常工作，因为已经有公网ip了，所以需要弄一个DDNS。因为搭建VaultWarden需要https，在查资料的过程中发现了[lucky](https://lucky666.cn/)这个很好用的国产软件，索性把家里的DDNS和端口转发都换成了Lucky。

具体的流程就是首先在openwrt上面下载vaultwarden的镜像，因为国内docker默认镜像源用不了，所以我是用了github的镜像源：
```bash
docker pull ghcr.io/dani-garcia/vaultwarden:latest
```
之后在本地创建一个文件用来保存运行相关的环境变量：
```
ROCKET_PORT=1089
.....
```
当然了，也可以选择在运行docker的时候通过命令行带着，但是因为要加的变量很多，我就弄了个文件放。另外本地也要选择一个文件夹用来存放vaultwarden的数据。
```bash
docker run -d --name vaultwarden -v /data/vw-data:/data --network host --env-file /user/sam/env --restart unless-stopped  ghcr.io/dani-garcia/vaultwarden:latest
```

我这里的配置是通过环境变量指定了端口，然后docker里面使用宿主机的网络，而不是像官网文档那样用了桥接，至于原因则是因为在openwrt里面停了重启发现网卡被占用启动不了。按照如上步骤即可完成vaultwarden的启动了。

但是这样服务还是不能使用，因为没有https服务，vaultwarden还无法完成身份认证。因此需要使用lucky了，我们可以选择把它安装在openwrt上，也可以安装到docker里面，而我发现我华硕路由器的koolshare软件中心里面就有，遂决定把他放到路由器里面。

安装完lucky后，首先是到自己的域名解析服务商那里把二级域名弄好，因为自动申请证书和DDNS都需要，DNS最好使用Cloudflare，阿里云，DNSPod等几家可以通过api修改解析，lucky里面又内置了的，这样可以减少很多麻烦。搞好之后，就可以去lucky里面先弄证书自动申请了，当然有证书的可以直接添加进去，我这里用了ACME申请`Let's Encrypt`证书。入口在“安全管理里面”点击添加证书，更加具体的可以看官方文档，这里搞好之后，后面设置端口转发或者设置web服务的时候都会使用这个证书。

![](https://img.isming.me/image/lucky-ssl.png)

搞完SSL证书，我想到我这里其实不需要通过端口转发来实现，完全可以通过Lucky的web服务功能来做，于是就创建一条web服务的规则,如下：

![](https://img.isming.me/image/lucky-web-proxy.png)

监听端口为对外暴露的端口，TLS启用就开启网站的HTTPS功能，前提也要先配置好证书才能打开。默认规则中服务类型选择反向代理，目标地址就是我们的服务的地址，例如`http://192.168.1.10:1089`,万事大吉打开，这样有些header都能正确的传过去。

这一切都搞完，就可以去浏览起打开注册用户了。
![](https://img.isming.me/image/vault-register.png)


为了安全起见，最好注册完之后把注册功能给关掉，做法就是修改环境变量。
```
SIGNUPS_ALLOWED=false

```
另外，Admin页面也是默认关闭的，我自认为没有必要打开，因此就保留了原样。为了方便起见，把邮箱SMTP功能配置上，这样就可以去验证邮箱使用邮箱验证登录，同时主密码忘记提示词也可以发送到邮箱。配置上DOMAIN，记得要带上前面的https和后面的端口，这样就可以使用webauth了。一切 就绪，就可以去重新启动docker了。
```shell
docker stop vaultwarden
docker rm vaultwarden
docker run -d --name vaultwarden -v /data/vw-data:/data --network host --env-file /env --restart unless-stopped  ghcr.io/dani-garcia/vaultwarden:latest
```
虽然把之前的docker容器删掉了，但是因为数据是映射到本地目录的，所以都还在。

前面这些搞完之后，为了数据的安全，我们还需要定期对数据进行备份，我是把阿里云盘挂载到本地了，因此直接把数据文件拷贝过去就实现了远程备份。为了足够高的安全，我是备份了两份，一份在阿里云盘，一份放到家里的另一块硬盘上。具体通过crontab每天定时执行脚本，把数据目录压缩，放置到对应的目录，备份的时候会把最老的那一个备份删掉。脚本如下：
```bash
#!/bin/bash

SRC_DIR=/mnt/sda1/vw-data/
LOG_FILE=/mnt/sda1/log/Error_Log_$(date +%Y%m%d).log
MAX_NUM=10
NOTIFY_URL=https://sctapi.ftqq.com/[apikey].send
DEST_ALIYUN=/mnt/aliyundriver/backup/vaultwarden
DEST_SDB=/mnt/sdb1/backup/vaultwarden


function notify {
	curl --data-urlencode "title=${1}" "${NOTIFY_URL}"
}


function log {
	echo "$(date +'%Y-%m-%d %H:%M:%S') $1" >> ${LOG_FILE}
	notify "$1"
	
}

function compress {
	if [ ! -d "${DEST_SDB}" ]; then
		log "错误：第二块硬盘不存在，无法进行备份"
		return
	fi
	dest_file=${DEST_SDB}/vw_backup_$(date +%Y%m%d).zip
	7z a -tzip ${dest_file} ${SRC_DIR} > /dev/null 2>&1
	if [ $? -eq 0 ]; then
		echo "压缩完成,文件存在${dest_file}"
		if [ ! -d "${DEST_ALIYUN}" ];then
			log "错误：阿里云目录未挂载，请检查"
			return
		fi
		cp ${dest_file} ${DEST_ALIYUN}/
	else
		log "错误：压缩出现错误"
		return
	fi
	notify "今日备份成功$(date +%Y%m%d)"
}

function delete_old_archives {
	num=$(ls -l ${1} | grep "^-" | wc -l) 
	echo $num
	while  [ ${num} -gt ${MAX_NUM} ]
	do
		file=$(ls -rt ${1}/vw_backup_*.zip | head -n 1)
		if [ -n "${file}" ];then
			rm -f "${file}"
			echo "删除旧文件${file}"
		else
			echo "没有找到旧文件"
			break
		fi
		let num--
	done
}

function main {
	compress
	delete_old_archives "${DEST_ALIYUN}"
	delete_old_archives "${DEST_SDB}"
}

main

```

这样一通操作下来，自认为安全方面是有保障了，只是比之前的全部本地稍微差一点点。vaultwarden也提供了比较全的导入导出功能，因此我原来的keepass数据可以很容易到导入，基本做到了无缝切换。使用了两天下来，网页端的自动填充功能确实要强大很多。同时内置了OTP功能，一些需要二次验证的服务，可以自动把OTP Code输入了，这个后面可以把原来用的一些转移过来。唯独的问题是，vaultwarden的OTP code无法放到vaultwarden中去。

本来打算这个服务搭好之后，让老婆也一起用，提高全家账号的安全性，然而她却说用不上，手机上基本不需要输入密码，没必要多记一个密码了。不过对于大部分人来说也确实是，短信登录加上微信登录已经解决了大部分场景，密码管理服务对他们来说只是伪需求。也可能只对于我们这一小部分爱折腾的人才比较有点用吧。

搭建这个服务，参考了不少网上的内容。关于docker的使用和shell脚本的编写，也多亏了GPT。最后在列出一些参考了的资料：
1. [Vaultwarden wiki 中文版](https://rs.ppgg.in/configuration/configuration-overview)
2. [自建 vaultwarden / bitwarden_rs 密码管理器](https://atpx.com/blog/docker-vaultwarden/)
3. [Lucky使用指南](https://lucky666.cn/docs/intro)