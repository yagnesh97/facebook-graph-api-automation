/*
MIT License

Copyright (c) 2020 yagnesh97

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

//import all the required modules 

var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const s3 = new AWS.S3();

const fs = require('fs');
const { promisify } = require('util');

const request = require('request-promise');


//include environment variables

const BucketName = process.env.bucketName;  //S3 bucket name
const KeyName = process.env.keyName;    //JSON file name (fb-app.json)
const FbExchangeToken = process.env.fbToken;    //intial long lived token
const PageId = process.env.pageId;  //facebook page id
const ClientId = process.env.clientId;  //facebook app id
const ClientSecret = process.env.clientSecret;  //facbook app secret


//method to regenerate facebook long lived token from existing token

async function GenerateFBAccessToken (fbExchangeToken) {
    const parameters = {
        method: 'GET',
        uri: `https://graph.facebook.com/v6.0/oauth/access_token`,
        qs: {
            grant_type: 'fb_exchange_token',
            client_id: ClientId,
            client_secret: ClientSecret,
            fb_exchange_token: fbExchangeToken
        }
    };
    
    const response = {};
    
    await request(parameters)
    .then(result => {
        let data = JSON.stringify(result);
        data = JSON.parse(result);
        console.log('result: ', data);
        Object.assign(response, data);
    })
    .catch(err => {
        console.log('err: ', err);
    });
    
    console.log('response: ', response);
    return response;
}


//method to update fb-app.json in S3

async function WriteObject (data) {
    let body = JSON.stringify(data);
    
    const writeFile = promisify(fs.writeFile);
    await writeFile(`/tmp/${KeyName}`, body)
    .then(async result1 => {
        console.log('writeFile result: ', result1);
                        
        const readFile = promisify(fs.readFile);
        await readFile(`/tmp/${KeyName}`)
        .then(async data => {
            let base64data = Buffer.from(data, 'binary');
            
            await s3.putObject({
                Body: base64data, 
                ACL: 'private', 
                Bucket: BucketName,
                Key: KeyName
            }).promise()
            .then((result2) => {
                console.log('putObject result: ', result2);
            })
            .catch((err) => {
                console.log('putObject err: ', err);
            });
        })
        .catch(err => {
            console.log('readFile err: ', err);
        });
    })
    .catch(err => {
        console.log('writeFile err: ', err);
    });
}


//method to read object i.e. fb-app.json from S3 

async function ReadObject () {
    const response = {};
    const params = { Bucket: BucketName, Key: KeyName };
    
    await s3.getObject(params).promise()
    .then(result => {
        const data = result.Body.toString('utf-8');
        console.log('data: ', data);
        
        Object.assign(response, JSON.parse(data));
    }).catch(err => {
        console.log('err: ', err);
    });
        
    return response;
}


//program execution begins from here

exports.handler = async (event) => {
    let bucketExist = false;
    
    //read or write S3 bucket
    await s3.listBuckets().promise()
    .then(async result1 => {
        let bucketList = result1.Buckets;
        let filterBucket = bucketList.filter(item => item.Name === BucketName);
        if (filterBucket.length > 0) {
            console.log('bucket found!');
            bucketExist = true;
        } else {
            console.log('bucket not found!');
            var bucketParams = {
                Bucket : BucketName,
                ACL : 'private'
            };
            await s3.createBucket(bucketParams).promise()
            .then(result2 => {
                console.log('bucket created!');
                bucketExist = true;
            })
            .catch(err => {
                console.log('bucket not created!');
                console.log('err: ', err); 
            });
        }
    })
    .catch(err => {
       console.log('err: ', err); 
    });
    
    const objectData = {};
    
    //read or write obeject inside S3 bucket
    if (bucketExist) {
        var bucketParams = {Bucket : BucketName};
        await s3.listObjects(bucketParams).promise()
        .then(async result1 => {
            console.log('result1: ', result1);
            
            let objectList = result1.Contents;
            let filterObjectList = objectList.filter(item => item.Key === KeyName);
            if (filterObjectList.length > 0) {
                console.log('object found!');
                let data = await ReadObject();
                Object.assign(objectData, data);
            } else {
                console.log('object not found!');
                
                let data = await GenerateFBAccessToken(FbExchangeToken);
                console.log('data: ', data);
                if (Object.keys(data).length > 0) {
                    await WriteObject(data);
                    Object.assign(objectData, data);
                } else {
                    console.log('error in generating token.');   
                }
            }
        })
        .catch(err => {
            console.log('err: ', err);
        });
    }
    
    /* check if token has expired and generate a new token. if not, will use the same token.
    update object (fb-app.json) */

    if (Object.keys(objectData).length > 0) {
        let expires = parseInt(objectData.expires_in, 10);
        console.log('expires: ', expires);
        if (Math.floor(expires/86400) <= 1) {
            let data = await GenerateFBAccessToken(objectData.access_token);
            console.log('data: ', data);
            if (Object.keys(data).length > 0) {
                Object.assign(objectData, data);
                await WriteObject(data);
            }
        } else {
            Object.assign(objectData, {
                expires_in: parseInt(objectData.expires_in, 10) - 86400
            });
            await WriteObject(objectData);
        }
    }

    //post feed, photos or video throught API. currently im posting photos
    const postTextOptions = {
        method: 'POST',
        uri: `https://graph.facebook.com/${PageId}/photos`,
        qs: {
            access_token: objectData.access_token,
            url: 'https://pixabay.com/get/57e9d2454d50a914f1dc84609629317e1536dfe75a4c704c7d297cd49349c75e_640.jpg', //replace with an image url
            message: 'This is my first feed!' //replace with your feed or message
        }
    };
    await request(postTextOptions)
    .then(response => {
        console.log('graph response: ', response);
    })
    .catch(error => {
        console.log('graph error: ', error);
    });
    return;
};