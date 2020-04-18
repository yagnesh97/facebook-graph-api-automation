var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const s3 = new AWS.S3();

const mysql = require('mysql');
const config = {
    host     : process.env.host,
    user     : process.env.user,
    password : process.env.password,
    database : process.env.database
};

const fs = require('fs');
const { promisify } = require('util');
const request = require('request-promise');

const BucketName = process.env.bucketName;
const KeyName = process.env.keyName;
const FbExchangeToken = process.env.fbToken;
const PageId = process.env.pageId;
const ClientId = process.env.clientId;
const ClientSecret = process.env.clientSecret;

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

function GetQuestion () {
    return new Promise(async (resolve, reject)=>{
        const connection = await mysql.createConnection(config);
        let query = promisify(connection.query).bind(connection);
        let result = await query('call fb_graph_api_rt(?)', [new Date().toISOString().split('T')[0]]);
        connection.end();
        console.log('fb_graph_api_rt: ', result);
        return resolve(result);
    });
}

function GetRandomNumber (max) {
    return Math.floor(Math.random() * Math.floor(max));
}

async function GenerateResponse (message) {
    const apikey = process.env.pixabayAPIKey;
    let pixabayURL = `https://pixabay.com/api/?key=${apikey}&q=${message.category_name}&image_type=photo&page=1&per_page=3&safesearch=true&orientation=horizontal&order=popular&editors_choice=true`;
    let parameters = {
        method: 'GET',
        uri: pixabayURL,
    };

    let question = message.question_text.trim();
    question = question.substring(0, question.length-1);

    let textMessage = 'Hi folks❗️ 🤟\n'
    + `🌞 Here is today\'s question from ${message.category_name} ✨\n\n`
    + `🤔 Question: ${question} ❓\n\n`
    + `Comment your answer below❗️ 😋👇\n`
    + `.\n.\n.\n#AmazonAlexa #AmazonEcho #QuizOfTheDay #Trivia #Quiz`;

    let response = {
        textMessage
    };

    await request(parameters)
    .then(result => {
        let data = JSON.parse(result);
        let defaultImageURL = 'https://pixabay.com/get/57e9d2454d50a914f1dc84609629317e1536dfe75a4c704c7d297cd49349c75e_640.jpg';
        let hitsLength = data.hits.length;
        let hit = data.hits[GetRandomNumber(hitsLength)];

        let imageURL = hitsLength === 0 ? defaultImageURL : hit.webformatURL
        let tags = hitsLength === 0 ? hit.tags : message.category_name;

        Object.assign(response, {
            imageURL,
            tags,
        });
    });

    return response;
}

exports.handler = async (event) => {
    let bucketExist = false;
    
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

    let messageData = await GetQuestion ();
    let message = await GenerateResponse(messageData[0][0]);

    const postTextOptions = {
        method: 'POST',
        uri: `https://graph.facebook.com/${PageId}/photos`,
        qs: {
            access_token: objectData.access_token,
            url: message.imageURL,
            message: message.textMessage
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