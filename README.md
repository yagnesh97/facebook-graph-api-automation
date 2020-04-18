# Facebook Graph API Automation

This codebase will help you to setup a cron job and automating stuff like posting feed, photo or video on Facebook page.

## Getting Started

Before you get started, you must have a Facebook page, Facebook Developer Account or any hosting service to host your serverless script. I'm using AWS Lambda to host my script and to schedule a cron job (invokes my script everyday). 

Let's dive into coding part!

**Why am I using AWS service?**

-To host my script on Lambda

-To schedule a cron job

-Most importantly, to regenerate Long Lived tokens. A long-lived token generally lasts about 60 days. I'm automating this process too so, you don't need to update your code twice a month.

### Prerequisites

Things you'll require to build this stuff. I would recommend you to watch this [tutorial](https://www.youtube.com/watch?v=WteK95AppF4&t=12s) to setup Facebook page, Facebook Developer's Account and Facebook App.

###### Non Technical
```
Facbook Page Id

Facebook App in Facebook Developer's Account for App Id and App Secret

Facebook Long Lived Access Token

AWS Account
```

**[How to find Facebookd Page Id?](https://www.facebook.com/help/1503421039731588)**

**[How to find App Id and App Secret?](https://developers.facebook.com/docs/graph-api/using-graph-api)**

**[How to generate Long-Lived Token for the first time?](https://developers.facebook.com/tools/debug/accesstoken/)**

**[How to generate Long Lived Token through API?](https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing/)**

###### Technical
```
Node.js
```

### Installing
Install Node.js on your machine. 

Create a folder **facebook_demo**.

Open your terminal and change your directory to **facebook_demo**.

Create NPM Package and fill up your package details by running:
```
npm init
```

Install Node Modules by runing:
```
npm install aws-sdk --save
npm install request-promise --save
npm install fs --save
```

Now that you have successfully installed the above modules, just create an **index.js** file and copy the code or clone repository.

## Create a JSON file

Here's the most important part comes in.

Create a JSON file namely **fb-app.json**. This file will be used to automate the process of regenerating [Long-Lived Token](https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing/) and to keep a track on its expire time.

The below given api will request a new [Long-Lived Token](https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing/) from your Access Token.

**Request:**
```
https://graph.facebook.com/{graph-api-version}/oauth/access_token?  
    grant_type=fb_exchange_token&          
    client_id={app-id}&
    client_secret={app-secret}&
    fb_exchange_token={your-access-token}"
```
**Response:**
```
{
  "access_token":"{long-lived-user-access-token}",
  "token_type": "bearer",
  "expires_in": 5183944            //The number of seconds until the token expires
}
```
Now in **fb-app.json**, copy this reponse and replace **{long-lived-user-access-token}** with your current Long-Lived Token.

Don't forget to remove comments.

**If you don't know how to generate Long-Lived Token for the first time. [Click Me](https://developers.facebook.com/tools/debug/accesstoken/)!**

Paste your existing token which you might have generated while testing and then click on Debug button. 

Click **Extend Access Token**.

Save your file.

### Move to S3

Create a private bucket on Amazon S3. Upload your file to S3 under private ACL (Access Control List).

## Deployment

Create a zip of all files placed inside **facebook_demo**. Upload your zip on Lambda.

This is not it. 


-Go to **Permissions** tab. 

-Click on you Role Name.

-Click on Attach Policy.

-Search and select **AmazonS3FullAccess** and click on Attach Policy button.

Now, your Lambda function can have access to S3 bucket and its objects.

Also, I have used **Environment Variables**. Just refer the code and create Environment Variables accordingly. Its a good practice to make use of such functionalities for better and secure coding.

## Author

**Yagnesh Vakharia**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Contact

yagneshvakharia97@gmail.com
