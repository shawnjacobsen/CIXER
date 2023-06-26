import React, { useState, useEffect } from 'react';
import { ChatCompletionRequestMessageFunctionCall } from 'openai'
import { Button, Form, Container, Row, Col, Navbar, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { cleanStringToAscii } from './helpers'
import { getOpenAIApiObject, getResponse, getSystemPrompt } from './bot';

export interface Link {
	name: string;
	href: string;
}

export interface Message {
	role: 'user' | 'assistant' | 'system' | 'function'
	content?: string
	function_call?:ChatCompletionRequestMessageFunctionCall
	links?: Array<Link>
	name?: string
}

const ChatBox: React.FC<{ authToken: string }> = ({ authToken }) => {
	const [chatMessages, setChatMessages] = useState<Array<Message>>([]);
	const [openai] = useState(getOpenAIApiObject());
	const [input, setInput] = useState('');
	const [isLoading, setLoading] = useState<boolean>(false);

	// init system prompt
	useEffect(() => {
		const initSystemPrompt = async () => {
			const systemPrompt = await getSystemPrompt()
			setChatMessages([ { role:'system', content: systemPrompt } ])
		}
		initSystemPrompt()
	},[])

	// logging messages (DEVELOPMENT)
	useEffect(() => {
		console.log(chatMessages)
	},[chatMessages])

	/** MESSAGE HANDLING */
	const handleSubmit = async (event) => {
		event.preventDefault();
		// add user message to the chatMessage array
		const userMessage: Message = {
			content: cleanStringToAscii(input), // fix any possible ascii issues
			role: 'user',
		};
		const updatedMessages:Array<Message> = [...chatMessages, {...userMessage}]
		setChatMessages(updatedMessages);
		
		// clear input and set loading to true
		setInput('');
		setLoading(true);

		// Pass the new chatMessage array to getResponse
		const newMessages: Array<Message> = await getResponse(updatedMessages, authToken, openai);
		setLoading(false);
		setChatMessages(newMessages);
	};

	return (
		<Container className='app-container'>
			<Navbar expand='lg' variant='dark' className='app-navbar'>
				<Navbar.Brand href='#'>
					<FontAwesomeIcon icon={faCommentDots} /> ChairGPT
				</Navbar.Brand>
			</Navbar>
			<div className='messages-container'>
				{chatMessages.filter(message => 
				(message['role'] === 'user' || message['role'] === 'assistant') && message['content']
					).map((message, index) => (
					<div key={index} className={'card ' + (message.role === 'user' ? 'user-card' : 'bot-card')}>
						<Row>
							<Col xs={2}>
								<strong>{message.role === 'user' ? 'User:' : 'ChairGPT:'}</strong>
							</Col>
							<Col xs={10}>
								<div className='message-field'>
									<div className='message-text'>{message.content}</div>
									{message.links && message.links.length > 0 && (
										<>
											<br />
											<div className='message-links'>
												{message.links.map((link, i) => (
													<span key={i} className='chat-link'>
														<a href={link['href']}>{link['name']}</a>
													</span>
												))}
											</div>
										</>
									)}
								</div>
							</Col>
						</Row>
					</div>
				))}
				{isLoading && <Spinner animation='border' />}
			</div>
			<Form onSubmit={handleSubmit} className='input-form'>
				<div className='input-container'>
					<Form.Group className='input-field'>
						<Form.Control
							type='text'
							placeholder='Enter message'
							value={input}
							onChange={(e) => setInput(e.target.value)}
						/>
					</Form.Group>
					<Button variant='secondary' type='submit' disabled={isLoading}>
						{isLoading ? 'Sending...' : 'Send'}
					</Button>
				</div>
			</Form>
		</Container>
	);
};

export default ChatBox;
