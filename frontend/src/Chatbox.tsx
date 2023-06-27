import React, { useState, useEffect, useRef } from 'react';
import { ChatCompletionRequestMessageFunctionCall } from 'openai';
import { Button, Form, Row, Col, Navbar, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { cleanStringToAscii } from './helpers';
import { getOpenAIApiObject, getResponse, getSystemPrompt } from './bot';
import useAutosizeTextArea from './useAutosizeTextArea';

export interface Link {
	name: string;
	href: string;
}

export interface Message {
	role: 'user' | 'assistant' | 'system' | 'function';
	content?: string;
	function_call?: ChatCompletionRequestMessageFunctionCall;
	links?: Array<Link>;
	name?: string;
}

const ChatBox: React.FC<{ authToken: string }> = ({ authToken }) => {
	const [chatMessages, setChatMessages] = useState<Array<Message>>([]);
	const [openai] = useState(getOpenAIApiObject());
	const [input, setInput] = useState('');
	const [isLoading, setLoading] = useState<boolean>(false);
	const spinnerContainerRef = useRef<HTMLDivElement>(null);
	const textAreaRef = useRef<HTMLTextAreaElement>(null);

	// handle the textarea
	useAutosizeTextArea(textAreaRef.current, input);
	const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target?.value;
		setInput(val);
	};

	// // init system prompt
	useEffect(() => {
		const initSystemPrompt = async () => {
			const systemPrompt = await getSystemPrompt()
			setChatMessages([ { role:'system', content: systemPrompt } ])
		}
		initSystemPrompt()
	},[])

	// auto scroll to new messages
	useEffect(() => {
		// logging messages (DEVELOPMENT)
		console.log(chatMessages);
		if (spinnerContainerRef.current) {
			spinnerContainerRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [chatMessages]);

	/** MESSAGE HANDLING */
	const handleSubmit = async (event) => {
		event.preventDefault();
		// add user message to the chatMessage array
		const userMessage: Message = {
			content: cleanStringToAscii(input), // fix any possible ascii issues
			role: 'user'
		};
		const updatedMessages: Array<Message> = [...chatMessages, { ...userMessage }];
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
		<div className='app-container'>
			<Navbar expand='lg' variant='dark' className='app-navbar'>
				<Navbar.Brand href='#'>
					<FontAwesomeIcon icon={faCommentDots} /> ChairGPT
				</Navbar.Brand>
			</Navbar>
			<div className='messages-container'>
				{chatMessages
					.filter((message) => (message['role'] === 'user' || message['role'] === 'assistant') && message['content'])
					.map((message, index) => (
						<div key={index} className={'card ' + (message.role === 'user' ? 'user-card' : 'bot-card')}>
							<Row>
								<Col xs={2}>
									<strong>{message.role === 'user' ? 'User:' : 'ChairGPT:'}</strong>
								</Col>
								<Col xs={10}>
									<div className='message-field'>
										<div className='message-text'>
											{/* Display newlines */}
											{message.content.split('\n').map((line, i) => (
												<span key={i}>
													{line}
													<br />
												</span>
											))}
										</div>
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
				<div ref={spinnerContainerRef} className='spinner-container'>
					{isLoading && <Spinner animation='border' className='messages-spinner' />}
				</div>
			</div>
			<Form onSubmit={handleSubmit} className='input-form'>
				<Form.Group className='input-field-group'>
					<div className='position-relative'>
						<Form.Control
							className='input-field'
							type='text'
							as='textarea'
							placeholder='Send a message'
							value={input}
							ref={textAreaRef}
							rows={1}
							onChange={handleTextAreaChange}
							// submit message if Enter is pressed without Shift
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSubmit(e);
								}
							}}
						/>
						<Button
							className='input-submit-btn position-absolute'
							variant='secondary'
							type='submit'
							disabled={isLoading}
						>
							Send
						</Button>
					</div>
				</Form.Group>
			</Form>
		</div>
	);
};

export default ChatBox;
