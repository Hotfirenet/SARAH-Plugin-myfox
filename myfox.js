/**
* Declaration des constantes
*/
const mf_urlToken = 'https://api.myfox.me/oauth2/token';
const mf_siteUrl = 'https://api.myfox.me:443/v2/client/site/list?access_token=%s';
const mf_getSecurityUrl = 'https://api.myfox.me:443/v2/site/%d/security/get?access_token=%s';
const mf_setSecurityUrl = 'https://api.myfox.me:443/v2/site/%d/security/set/%s?access_token=%s';

/**
* Declaration des variables
*/
var util = require('util');
var mf_debug = false;
var mf_error = false;
var mf_client_id = '';
var mf_client_secret = '';
var mf_username = '';
var mf_password = '';
var mf_timestamp;
var mf_tokenExpires_in = 0;
var mf_token = '';
var mf_tokenRefresh = '';
var mf_site = new Array();
var msg = '';

/**
* SARAH myfox init function
*/
exports.init = function (SARAH)
{	
	SARAH.context.myfox = {};
		
	var config = SARAH.ConfigManager.getConfig();
	config = config.modules.myfox;  

	mf_client_id = config.client_id;
	mf_client_secret = config.client_secret;
	mf_username = config.username;
	mf_password = config.password;
	
	mf_idCentrale = config.idCentrale;	
} 

/**
* SARAH myfox action function
*/
exports.action = function(data, callback, config, SARAH) 
{	
	getToken(mf_client_id, mf_client_secret, mf_username, mf_password, function(token)
	{
		if(token.token)
		{			
			if(mf_debug)
			{
				console.log('token: ' + mf_token + ' expire: ' + mf_tokenExpires_in + ' now: ' + mf_timestamp);
				var test = mf_tokenExpires_in - mf_timestamp;
				console.log('Le token est valable encore '+ test +'  s');	
			}
				
			switch(data.myFoxAction)
			{
				case 'listSite':
					listSite(token.token, function(cb) {
					
						if(mf_debug)
							console.log('Action -> listSite: ' + cb);					
					
						callback({'tts' : cb});
					});
					break;
			
				case 'getSecurity':
					
					if(mf_debug)
						console.log('1 - Action -> getSecurity');
										
					getSecurity(mf_idCentrale, token.token, function(state)
					{
						var myState = '';
					
						if(mf_debug)
							console.log('5 - Action -> getSecurity: ' + state);
						
						switch(state)
						{
							case 'armed':
								myState = 'L\'alarme est totalement activée';
								break;
							
							case 'partial':
								myState = 'L\'alarme est partiellement activée';
								break;
								
							case 'disarmed':
								myState = 'L\'alarme est désactivée';
								break;
							
							default:
								myState = 'Le statut n\'est pas connu ';
								break;
						}	
						
						SARAH.context.myfox.status = myState;						
						if(data.silent == 1)
						{
							myState = '{"state" : ' + myState + '}';
						}	
						
						callback({'tts' : myState});
					});	
						
					break;

				case 'setSecurity':
					setSecurity(mf_idCentrale, data.level, token.token, function(response){
						callback({'tts' : response});
					});
					break;
					
				default:
					callback({'tts' : 'Action inconnu'});
					break;							
			}
		}
		else
		{
			msg = 'Erreur d\'identification';
			callback({'tts' : msg});
		}	
		return;		
	});
}

/**
* SARAH myfox cron function
*/
exports.cron = function(callback, task, SARAH)
{
	if(mf_error)
	{
		console.log('Erreur de connexion a l\'api myfox dans le cron');
		callback({});
		return;		
	}
	else
	{
		getToken(mf_client_id, mf_client_secret, mf_username, mf_password, function(token)
		{
			if(token.error)
			{
				SARAH.speak(token.error);
				mf_error = true;
				return ;						
			}
			else
			{
				getSecurity(mf_idCentrale, token.token, function(state){
					if(mf_debug)
						console.log(state);
						
					SARAH.context.myfox.status = state;
				});	
			}	
		});		
	}
}



/**
* Check state myFox API Token
*/
var getSecurity = function(siteId, token, cb)
{
	var getSecurityUrl = util.format(mf_getSecurityUrl, siteId, token);
	
	sendRequest(getSecurityUrl, function(responseRequest){

		state = JSON.parse(responseRequest);
		
		if(state.status == 'KO')
		{
			console.log(state.error);	
			cb(state.error);			
			return;
		}
		else
		{			
			if(mf_debug)
				console.log('getSecurity: ' + state.payload.statusLabel);
				
			cb(state.payload.statusLabel);
		}		
	});
}

/**
* Set state myFox API Token
*/
var setSecurity = function(siteId, securityLevel, token, cb)
{
	var setSecurityUrl = util.format(mf_setSecurityUrl, siteId, securityLevel, token);
	
	sendRequest(setSecurityUrl, function(responseRequest){

		console.log(responseRequest);
	
		levelResponse = JSON.parse(responseRequest);
		
		if(levelResponse.status == 'KO')
		{
			console.log(levelResponse.error);	
			cb(levelResponse.error);
			return;
		}
		else
		{			
			if(mf_debug)
				console.log('setSecurity: ' );
				
			cb(levelResponse.status);
		}		
	});
}


/**
*
*/
//https://api.myfox.me:443/v2/site/4213/history/get?type=alarm
var gethistory = function()
{

}

/**
* list Site myFox API Token
*/
var listSite = function(token, cb)
{
	var siteUrl = util.format(mf_siteUrl, token);
	
	sendRequest(siteUrl, function(responseRequest){
	
		if(mf_debug)
			console.log('listSite: ' + responseRequest);	
	
		cb(responseRequest);
		// var mySite = JSON.parse(responseRequest);
		// Object.keys(mySite.payload).forEach(function(key) 
		// {
			// cb = {key, mySite.payload[key].label};
			
			// if(mf_debug) 
			// {
				// console.log(key);
				// console.log(mySite.payload[key].label);			
			// }
		// });
	});
}

/**
* Generate myFox API Token
*/
var getToken = function(client_id, client_secret, username, password, cb)
{	 
	if(mf_debug)
		console.log('1 - getToken');

	mf_timestamp = Math.round(+new Date()/1000);
	var mf_form = '';
	
	if(mf_timestamp > mf_tokenExpires_in) 
	{
		if(mf_debug)
			console.log('2 - Token doesn\'t exist');
			
		mf_form = {    
					'grant_type' 	: 'password',
					'client_id' 	: client_id,
					'client_secret' : client_secret,
					'username' 	: username,
					'password'	: password
				  };		
	}
	else
	{
		if(mf_debug)
			console.log('2 - Token exist');	
			
		mf_form = {    
					'grant_type' 	: 'refresh_token',
					'client_id' 	: client_id,
					'client_secret' : client_secret,
					'refresh_token' : mf_tokenRefresh
				  };
	}	
	
	var request = require('request');
	
	if(mf_debug)
	{
		console.log(mf_form);
		console.log('4 - Token: ' + mf_token);
		console.log('5 - RefreshToken: ' + mf_tokenRefresh);		
	}
	
	request({ 
			'uri'     : 	mf_urlToken,
			'method'  : 	'post',
			'headers' : { 
							'Content-type'   : 'application/x-www-form-urlencoded;charset=UTF-8'
						},
			'form'    : mf_form
			}
			, function (err, response, bodyToken)
			{		    
				if (err || response.statusCode != 200) 
				{
					console.log('erreur token: ' + err);
					cb({'error': 'HTTP Error'});
				  return;
				}

				if(mf_debug)
				{
					console.log('6 - reponse');					
					console.log('7 - bodyToken: ' + bodyToken + ' stop');
				}

				if(bodyToken == '')
				{
					console.log('8 - empty bodyToken');
					cb({'error': 'empty bodyToken'});	
					return;					
				} 
				else 
				{
					var token = JSON.parse(bodyToken);
					
					if(token.error) 
					{
					  console.log('8 - Token Error 1: ' + token.error_description);
					  cb({'error': 'KO, ' + token.error_description});
					  return;
					}			
					else
					{				
						mf_tokenExpires_in = Math.round(+new Date()/1000) + token.expires_in;
						mf_token = token.access_token;
						mf_tokenRefresh = token.refresh_token;
						if(mf_debug)
						{
							console.log(token);
							console.log('8 - getToken - Token: ' + token.access_token);
							console.log('9 - getToken - RefreshToken: ' + token.refresh_token);
						}
						
						cb({'token' : token.access_token, 'refresh_token': token.refresh_token});
						return;
					}				

				}
			}
		);	
}

/**
* send request
*/
var sendRequest = function (url, callback) 
{
	if(mf_debug)
		console.log(url);

	var request = require('request');
    request({
            'uri': url,
            'method': 'GET',
        },
        function (err, response, json) 
		{
			if (err || response.statusCode != 200) 
			{
				// /**
				// * i need 403 code beacause myfox return this code if is the bad argument (id, ...)
				// */
				if(response.statusCode != 403)
				{
					console.log(err);
					callback({'tts': "Operation Failed"});
					return;
				} 
				else
				{
					callback(json);
					return; 
				}
			}

			if(mf_debug)
				console.log(json);
			
            callback(json);
        });
}

/**
* displayed data on the dashboard
*/
exports.mf_portlet = function(SARAH)
{ 
	var data = {};

	data.css_status = SARAH.context.myfox.status;
	console.log(SARAH.context.myfox.status);
	data.connect = mf_error;
		
	return data; 
}