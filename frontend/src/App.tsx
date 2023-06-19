import React, { useContext, useEffect } from 'react';
import './App.css';
import ChatBox from './Chatbox';
import { AuthContext } from './AuthProvider';
import { crossOriginFetch } from './helpers'

function App() {
	const { account, login, error, inProgress, authToken } = useContext(AuthContext);
	return (
		<div className='App'>
			{authToken ? (
        <>
				  <ChatBox authToken={authToken} />
        </>
			) : (
				<button onClick={login} disabled={inProgress}>
					Log in
				</button>
			)}
		</div>
	);
}

export default App;
