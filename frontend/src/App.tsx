import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap'
import { InteractionType, InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { MsalAuthenticationTemplate, useMsal } from '@azure/msal-react';
import { userScopes } from './AuthProvider'

import ChatBox from './Chatbox';
import './App.css';

function App() {
	const { instance, accounts, inProgress } = useMsal();
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const getAuthToken = async () => {
      if (accounts.length > 0) {
        const params = {
          scopes: userScopes,
          account: accounts[0]
        };
  
        try {
          const response = await instance.acquireTokenSilent(params);
          setAuthToken(response.accessToken);
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) { 
            instance.acquireTokenRedirect(params);
          }
        }
      }
    }

    if (inProgress === InteractionStatus.None) {
      getAuthToken();
    }
  }, [accounts, inProgress, instance]);

	function signOutClickHandler(instance) {
		const logoutRequest = {
			account: instance.getAccountByHomeId(accounts[0]['homeAccountId']),
			postLogoutRedirectUri: "/",
		};
		instance.logoutRedirect(logoutRequest);
	}

	const SignOutButton = () => {
		// useMsal hook will return the PublicClientApplication instance you provided to MsalProvider
		const { instance } = useMsal();
	
		return (
			<Button
				className='logout-btn'
				onClick={() => signOutClickHandler(instance)}
				variant='secondary'
				type='submit'
			>Sign Out
			</Button>
		);
	}

	return (
		<>
		<MsalAuthenticationTemplate interactionType={InteractionType.Redirect}>
			<div className='App'>
					<ChatBox authToken={authToken} Logout={SignOutButton}/>
			</div>
		</MsalAuthenticationTemplate>
		</>
	);
}

export default App;
