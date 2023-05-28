from flask import Flask, request, redirect
import requests
import urllib

app = Flask(__name__)

@app.route('/')
def home():
    # Step 1: Redirect the user to the Microsoft OAuth2.0 endpoint
    params = {
        'client_id': 'YOUR_APP_CLIENT_ID',  # Replace with your app's client ID
        'response_type': 'code',
        'redirect_uri': 'http://localhost:5000/callback',  # Replace with your app's redirect URI
        'scope': 'Files.Read.All offline_access'  # The permissions your app needs
    }
    url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + urllib.parse.urlencode(params)
    return redirect(url)

@app.route('/callback')
def callback():
    # Step 2: The user is redirected here by Microsoft with an authorization code
    code = request.args.get('code')
    
    # Step 3: Exchange the authorization code for an access token
    data = {
        'client_id': 'YOUR_APP_CLIENT_ID',  # Replace with your app's client ID
        'client_secret': 'YOUR_APP_CLIENT_SECRET',  # Replace with your app's client secret
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': 'http://localhost:5000/callback'  # Replace with your app's redirect URI
    }
    response = requests.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', data=data)

    if response.status_code == 200:
        # Save the access token in the session
        access_token = response.json()['access_token']
        session['access_token'] = access_token
        return "Success! Your access token is: " + access_token
    else:
        return "Error: " + response.text

if __name__ == '__main__':
    app.run()