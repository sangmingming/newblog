---
title: Passkey在Android端的应用实践
comments: true
date: 2024-01-17 23:02:30 +0800
tags: [android]
---

Passkey，中文名通行密钥，他是WebAuthn的一部分，由FIDO联盟开发，可以做到让用户不使用用户名和密码，来直接验证身份。在2022年的WWDC上，Apple正式宣布了对Passkey的支持，当前10月份，google也宣布了对于passkey的支持。目前已经有一些应用支持了passkey，包括谷歌，微软，github，whatsapp等。最近在我们的Android应用上集成Passkey踩了很多的坑，简单记录一下。
![Passkey](/images/what-is-fido-fingerprint-authenticator.svg)
<!--more-->

### Passkey原理简介
简单来说，Passkey就是通过密钥对验证替代密码验证，原理和SSL/TLS验证类似，密钥对即公钥和私钥。用户的设备上存储的是私钥，创建的时候会将公钥发送到服务器端进行存储。验证的时候，服务端发送一段通过公钥加密的options信息，设备端使用私钥解密后回传给服务器，则能够验证成功。设备上的私钥需要验证用户的指纹、faceid或者yubikey才能使用。
Android系统需要Android 9.0以后，iOS系统需要iOS116以后才能支持，除此之外，Android设备需要登录google 账号，并且手机上有google play service才行，iOS需要开启iCloud 钥匙串。Appple 和 Google 还会通过他们的Cloud来帮助我们在多台设备之间同步同一个用户的身份验证，从而可以让我们实现同一个passkey在同一个用户的多台设备使用。
具体到Android系统，首先需要用户的手机系统在Android 9.0以上，我猜测这是因为在Android 9.0之后要求手机要有安全硬件，放到StrongBox的密钥必须是放到安全硬件中的。web用户可以在手机的chrome浏览器中使用passkey。对于Android应用则需要用户手机上安装的最新的（至少是2023年版本的）Google play service，且手机上的play services不能是中国特色的阉割版本，否则google password manager不能使用，应用也不能够使用Passkey。对于Android 14以后的系统，应用是可以使用第三方密码管理器的，不过我还没有实践，这里不做讨论。

### Android应用接入
![Passkey验证流程](/images/passkeys_accountcreation.png)
在Android中接入Passkey其实是比较简单的，具体是有两个场景，分别是创建Passkey和验证Passkey。

#### 准备工作

为了让Android系统能够识别我们的应用支持Passkey，需要在我们的后端服务器中配置我们的Digital Asset Links JSON文件，这个文件如果我们配置过Android的App Links支持，应该是已经有的，这个文件的路径应该为`https://example.com/.well-known/assetlinks.json`，配置的内容如下：
```json
[  
	{    
		"relation" : ["delegate_permission/common.handle_all_urls",      "delegate_permission/common.get_login_creds" ],
			"target" : {      
				"namespace" : "android_app", 
				"package_name" : "com.example.android",
				"sha256_cert_fingerprints" : [
				SHA_HEX_VALUE
				]
		}
	}
]
```

其中的relation用来指定声明的关系，handle_all_urls就是指可以让app处理所有的app links， get_login_creds指的是处理登录验证。
target是表示该声明应用到的目标，namespace指定为android应用，package_name为我们应用的包名，sha256_cert_fingerprints为应用的签名SHA256。
这个文件放到我们的服务器，需要保证访问路径，跟我们前面说到的一样。并且请求返回的Content-Type为application/json。如果我们的服务端有robots.txt文件要配置允许google去访问该文件：
```
User-agent : *
Allow: /.well-known/
```

Google为我们提供了`Credential Manager` 来使用Passkey,需要添加如下依赖:

```kotlin
dependencies {
	implementation("androidx.credentials:credentials:1.3.0-alpha01")
	implementation("androidx.credentials:credentials-play-services-auth:1.3.0-alpha01")
}
```

上面第二个依赖，如果我们是只支持Android 14以上，且不用谷歌的密码管理器，可以不用。
Proguard文件中需要添加如下内容：

```
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}
```

创建和验证Passkey都需要`CredentialManager`,创建方式如下：
```kotlin
val credentialManager = CredentialManager.create(context)
```

#### 创建Passkey

![创建Passkey](/images/create-passkey.svg)
创建Passkey的流程如上图所示，首先需要从服务端的接口拿到一些数据，把这个作为requestJson创建`CreatePublicKeyCredentialRequest`去调用创建Credential，代码如下：
```kotlin
val createPublicKeyCredentialRequest = CreatePublicKeyCredentialRequest(
requestJson = requestJson,
preferImmediatelyAvailableCredentials = true/false
)
coroutineScope.launch {
	try { 
		val result = credentialManager.createCredential(
			context = activityContext,
			request = createPublicKeyCredentialRequest
		)
	} catch (e: CreateCredentialException) {
		handleFailure(e)
	}
}
```

上面的requestJson是我们从服务端拿到的，他应该是符合WebAuthn标准的json内容，prefImmediatelyAvailableCredentials, 如何设置为true，手机上没有可用的passkey注册提供者会直接报错，而不是看有没有混合可用的passkey。requestJson的demo如下：

```json
{
  "challenge": "abc123", //服务端随机生成的字符串，用于后续判断客户端回传，用于避免被攻击
  "rp": {   //Replay party信赖方试题，用来表示应用信息，id为域名，需要和wellknown用的域名相同
    "name": "Credential Manager example",
    "id": "credential-manager-test.example.com"
  },
  "user": {  //用户信息，id和name不能缺少，displayName是可选的
    "id": "def456",
    "name": "helloandroid@gmail.com",
    "displayName": "helloandroid@gmail.com"
  },
  "pubKeyCredParams": [  //公钥凭据支持的算法类型和密钥类型，这个在webAuthn网站上可以找到相同的文档
    {
      "type": "public-key",
      "alg": -7
    },
    {
      "type": "public-key",
      "alg": -257
    }
  ],
  "timeout": 1800000, //验证超时时间，毫秒
  "attestation": "none",
  "excludeCredentials": [ //可选项，排除的凭据，可通过这个来限制不让同一台设备设置多个passkey
    {"id": "ghi789", "type": "public-key"},
    {"id": "jkl012", "type": "public-key"}
  ],
  "authenticatorSelection": { //设置支持的类型
    "authenticatorAttachment": "platform", //platform就只支持手机内置的，若为cross-platform就可支持usb的验证，yubikey等
    "requireResidentKey": true, //设置为true，则可检测到的凭据会将用户信息存到passkey中，并可以让用户在进行身份验证时选择账号。
    "userVerification": "required" //用于设置使用设备屏幕锁定功能进行用户验证，默认是preferred，用户可以跳过，建议设置为required。 
  }
}
```

以上json更多的解释可以看webauthn的网站： [Web Authentication: An API for accessing Public Key Credentials - Level 3 (w3c.github.io)](https://w3c.github.io/webauthn/#dictionary-makecredentialoptions)

我们客户端调用`createCredential`方法后拿到的结果，类似如下：
```json
{
  "id": "KEDetxZcUfinhVi6Za5nZQ", //创建的passkey的base64网址编码id，需要后端存储
  "type": "public-key", //此值始终为public-key，不过ios手机上可能为passkey
  "rawId": "KEDetxZcUfinhVi6Za5nZQ", 
  "response": {
    "clientDataJSON":   "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoibmhrUVhmRTU5SmI5N1Z5eU5Ka3ZEaVh1Y01Fdmx0ZHV2Y3JEbUdyT0RIWSIsIm9yaWdpbiI6ImFuZHJvaWQ6YXBrLWtleS1oYXNoOk1MTHpEdll4UTRFS1R3QzZVNlpWVnJGUXRIOEdjVi0xZDQ0NEZLOUh2YUkiLCJhbmRyb2lkUGFja2FnZU5hbWUiOiJjb20uZ29vZ2xlLmNyZWRlbnRpYWxtYW5hZ2VyLnNhbXBsZSJ9", //ArrayBuffer编码的客户端数据
    "attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViUj5r_fLFhV-qdmGEwiukwD5E_5ama9g0hzXgN8thcFGRdAAAAAAAAAAAAAAAAAAAAAAAAAAAAEChA3rcWXFH4p4VYumWuZ2WlAQIDJiABIVgg4RqZaJyaC24Pf4tT-8ONIZ5_Elddf3dNotGOx81jj3siWCAWXS6Lz70hvC2g8hwoLllOwlsbYatNkO2uYFO-eJID6A" //arraybuffer编码的证明对象，包含rpid，标志，公钥等
  }
}
```

我们需要将这个json回传给服务器端，服务器会从其中拿到公钥，并检查其中的数据跟服务端之前给客户端的challenge是否相同，相同后会将公钥，id，与用户id对应保存起来。

#### 验证Passkey

![验证Passkey](/images/sign-with-passkey.svg)
使用Passkey进行身份验证，首先也是需要从服务端拿一些信息，如下：
```json
{
  "challenge": "T1xCsnxM2DNL2KdK5CLa6fMhD7OBqho6syzInk_n-Uo",   //服务端生成防止被重现攻击，跟创建流程中的一样
  "allowCredentials": [], //允许的凭证，比如只允许当前设备之前创建的凭证
  "timeout": 1800000,
  "userVerification": "required",
  "rpId": "credential-manager-app-test.glitch.me"  //信任实体Id
}
```

客户端使用这个json来进行验证：
```kotlin
val getPublicKeyCredentialOption = GetPublicKeyCredentialOption(requestJson = requestJson)
val getCredRequest = GetCredentialRequest(listOf(getPublicKeyCredentialOption))
coroutineScope.launch {
 try {
	 val result = credentialManager.getCredential(context = activityContext, request = getCredRequest)
	 handleSignIn(result)
 } catch (e: GetCredentialException) {
	 handleFailure(e)
 }
}
```

google play service的凭据提供者会找到与rpid匹配的凭据，并且弹窗让用户选择，如果我们设置了allowCredentials并且只有一条会直接弹出指纹或生物验证，成功后会返回类似如下信息给我们：
```json
{
  "id": "KEDetxZcUfinhVi6Za5nZQ",
  "type": "public-key",
  "rawId": "KEDetxZcUfinhVi6Za5nZQ",
  "response": {
    "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiVDF4Q3NueE0yRE5MMktkSzVDTGE2Zk1oRDdPQnFobzZzeXpJbmtfbi1VbyIsIm9yaWdpbiI6ImFuZHJvaWQ6YXBrLWtleS1oYXNoOk1MTHpEdll4UTRFS1R3QzZVNlpWVnJGUXRIOEdjVi0xZDQ0NEZLOUh2YUkiLCJhbmRyb2lkUGFja2FnZU5hbWUiOiJjb20uZ29vZ2xlLmNyZWRlbnRpYWxtYW5hZ2VyLnNhbXBsZSJ9",
    "authenticatorData": "j5r_fLFhV-qdmGEwiukwD5E_5ama9g0hzXgN8thcFGQdAAAAAA",
    "signature": "MEUCIQCO1Cm4SA2xiG5FdKDHCJorueiS04wCsqHhiRDbbgITYAIgMKMFirgC2SSFmxrh7z9PzUqr0bK1HZ6Zn8vZVhETnyQ",
    "userHandle": "2HzoHm_hY0CjuEESY9tY6-3SdjmNHOoNqaPDcZGzsr0"
  }
}
```
回传以上信息给服务端，服务端会通过存储的公钥来验证signature，能验证则说明是匹配的用户，验证通过。
### 踩坑分享与总结
从上面的接入代码可以看到，google 的credentials libary已经帮我们把大部分的工作做掉了，我们更多的主要是去除了requestJson中的一些参数，客户端的代码还是比较简单的。当然也遇到很多的坑。
首先就是一定要保证服务端的返回json是要符合协议的，比如authenticatorSelection要按照格式来写，pubKeyCredParams最好把常见的支持的都加上，rp信息中的的name和id一定要有，id一定要用域名。

如果存在测试版本和线上版本包名不同，签名不同的情况，一定要分别设置好digital asset设置，如果用的是同一个域名，那么是可以在一个asset文件中设置多个app的。

因为google play services是该功能的基础，所以开发测试阶段使用的网络需要能够流畅的访问谷歌的服务。使用的测试机最好也是能够使用完整的google play services的。如果测试中出现类似下面的错误，可以去尝试升级google play services解决。
```
During create public key credential， fido registration failure： advy： Algorithm with COSE value -8 not supported
```

总体来说，如果是一个出海应用，并且对于应用的安全性有很高的要求，passkey是一个很好的解决方案。但是对于一个中国的应用来说，目前passkey还是不可用的，如果使用类似的公钥-私钥验证机制，那可以使用FIDO来实现。当然因为不是像google 和apple这样对于passkey支持这么好，实现起来会更加复杂，以后有机会可以再写一写。

### 参考资料

+ [Bringing seamless authentication to your apps with passkeys using Credential Manager API](https://medium.com/androiddevelopers/bringing-seamless-authentication-to-your-apps-using-credential-manager-api-b3f0d09e0093#172a)
+ [Web Authentication:An API for accessing Public Key Credentials Level 3](https://www.w3.org/TR/webauthn-3/)
+ [Sign in your user with Credential Manager](https://developer.android.com/training/sign-in/passkeys)
+ [What is a passkey? | Passkey.org](https://passkey.org/)