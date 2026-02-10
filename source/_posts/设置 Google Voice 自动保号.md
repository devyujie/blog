---
date: '2023-10-11 00:00:00'
permalink: Set-up-Google-Voice-to-automatically-keep-the-number/
title: 设置 Google Voice 自动保号
updated: '2026-02-10 13:10:00'
---

今天来讨论Google Voice的保号难题，本文章将通过Google Apps Script以实现自动保号，且极大概率避免账号被封风险。


## 转发短信至邮箱


在网页端 [登入 Google Voice](https://voice.google.com/)，进入设置页面，打开`将短信转发到电子邮件地址`，这样以后任何的短信收发都会被同时转发至邮箱内：


## 获取互保好友的ID


![bafkreicqjpupce7mevq2inbzxtjht6fyvzer37wn3mmvyv7z7lzeotfl4q.png](/images/3b4e17ea11dda04ad370dfd75944dcd2.png)


![bafkreih2646z23hprnwmztz3yp72tftu56pgow4cdpyxsdckg6xvehxeke.png](/images/28041d16ebe3b7356175652e81778a2a.png)


去 Google Voice 网页端，随便找一个和你互发短信的号码，复制他的号码，例如这个：


![bafkreifcgo5wrdo2lckkvhyhhneo5hlpqbwjv2ukxovjmpggdqtvgxgugy.png](/images/cb268f2265b779e40fae589bc9a2c1a2.png)


然后去邮箱里搜索这个号码，就会看到历史收发记录，随便点开一条记录。


**注意**：如果你是刚把第一步骤的短信转发至邮箱功能打开，那么邮箱里可能没有之前的收发记录，此时就要找你的互保好友给你发一条短信。没有互保好友的话，可以去 [这里](https://t.me/googlevoicebao)随便找一个。


![bafkreigfnclgsxb2wc7qpb3jerhdmsv2zjgwniaocjyuehpz6dj2kt3v2e.png](/images/2377d8c3e0be2599b77bab1047d5c2e5.png)


点开一条记录之后，把<>括号中的部分复制出来，例如：


```plain text
15153296615.12674773683.wcX4KJ99Sm@txt.voice.google.com
```


![bafkreib3p6p42krmdku7bki6ox4lx6zuqhbthiiln3l4z4rlo3xdactyvm.png](/images/382f730b7f9339ac4f8a3d04508ec8b6.png)


## 设置 Google Apps Script


进入 [Google Apps Script](https://script.google.com/home)，新建一个项目，把下边这段代码复制到编辑器中，并将刚刚复制的ID替换，然后**保存**：


```plain text
function autoReplier() {
  MailApp.sendEmail("你要替换的内容", "自动保号", "保号！");
}
```


![bafkreiehk4yhx32c63db23nkscdurk2yl3l2qd65pcuzjw67h5bjrfqssi.png](/images/b5bc710d52cf4ab29f430f84df275021.png)


然后找到触发器，点击右下角`添加触发器`:


![bafkreihk7m3u4phoqaxkvhtbobc73yr3nu2cqr4fxvsdn6rs2nejvudfle.png](/images/866a5267ebd0f039542d1171d4020e0f.png)


更改触发器时间类型，可以改为`周定时器`（每周发一次短信）或者`月定时器`（每月发一次短信），然后**保存**：


![bafkreihmiupalfxfwlkjoj6txzog4sbpga5dusiqhnxn5bcuooyds33zpe.png](/images/40ee7428d8c28badab63eb1b8ca88d7a.png)


可以再回到编辑器，点击`运行`，测试一下是否成功，下边会弹出执行日志，去Google Voice网页端看看短信是否发送成功（别要测试太多次！）：


![bafkreifz46gaum6rtb5c4j3wzhci3kk7kgizesgbr7biwtjw7qyndgo4re.png](/images/c5bbcd8e29bd5a4042d3dd9417db1863.png)


**此时，自动保号脚本设置完毕，Apps Script会根据你设置的定时器自动给你的好友发送短信，下边是一些额外的工作，如果你需要，可以继续看下去，如果不需要，就可以关掉这篇教程了。**


## 在邮箱中设置标签


进入邮箱设置：


![bafkreiaxo7kpt4fed735yty2he5f6qcbdi45uxpjad3eqyhp4ibzzrltnq.png](/images/398e346f72cfe7e21e3f8894f386c948.png)


创建新的过滤器：


![bafkreiggobtpi453rvjuzwrc4rsx2ru5tnwxak2ophrstqz3ezrdv54u7u.png](/images/c71e77bcea8ec210d1313ae50de72bac.png)


填写`收件人`和`包含字词`，收件人那里填刚刚复制的`好友ID`，包含字词那里填`保号`，然后点击`创建过滤器`：


![bafkreigmt2mccusmtdvyvs7zh6cn5poea7tkfrcjphq6loxdlju57hiftq.png](/images/560075c22b5b0c61a05f99502a6f9868.png)


在弹框中勾选应用标签，新建标签，填入一个名字，例如保号，点击创建，再点击创建过滤器：以后的保号短信（之前的不会显示）就会被收集到这个标签里，方便阅读查看。


![bafkreie2mdxi2jchng4fogsnramp3mms5nuwzubt4yhuk2wxvrm7z5cm2m.png](/images/8f10277e8a1dcefc544812b765702088.png)


![bafkreiacdc5por27vskk2lefgcutsjwrfxz6dtc6q7oybwixz62zktiasy.png](/images/6a6e86e16d4272399bae3fa72dfedab9.png)


以后的保号短信（之前的不会显示）就会被收集到这个标签里，方便阅读查看。


![bafkreibgun3hmj5axtks4se4zqrui2fu7ez37ady4lt7k6armifxm7onju.jpeg](/images/dd69f90d1b65943c40f596f20f97e565.jpeg)

