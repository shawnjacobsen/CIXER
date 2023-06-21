import React, { useState, useEffect } from 'react';
import { Button, Form, Container, Row, Col, Navbar, Spinner, FormCheck } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { Bot } from './bot';
export interface Link {
	name: string;
	href: string;
}
export interface Message {
	text: string;
	user: 'User' | 'Bot';
	links: Array<Link>;
}

const ChatBox: React.FC<{ authToken: string }> = ({ authToken }) => {
	const [messages, setMessages] = useState<Array<Message>>([]);
	const [bot] = useState<Bot>(new Bot());
	const [input, setInput] = useState('');
	const [isLoading, setLoading] = useState<boolean>(false);
	const [queryDocuments, setQueryDocuments] = useState<boolean>(true);

	/** MESSAGE HANDLING */
	const handleSubmit = async (event) => {
		event.preventDefault();

		const userMessage: Message = {
			text: input,
			user: 'User',
			links: []
		};
		setMessages([...messages, userMessage]);
		setInput('');
		setLoading(true);

		const botMessage: Message = await bot.getResponse(userMessage, authToken, queryDocuments);
		setLoading(false);
		setMessages((prev) => [...prev, botMessage]);
	};

	return (
		<Container className='app-container'>
			<Navbar expand='lg' variant='dark' className='app-navbar'>
				<Navbar.Brand href='#'>
					<FontAwesomeIcon icon={faCommentDots} /> ChairGPT
				</Navbar.Brand>
			</Navbar>
			<div className='messages-container'>
				{messages.map((message, index) => (
					<div key={index} className={'card ' + (message.user === 'User' ? 'user-card' : 'bot-card')}>
						<Row>
							<Col xs={2}>
								<strong>{message.user === 'User' ? 'User:' : 'ChairGPT:'}</strong>
							</Col>
							<Col xs={10}>
								<div className='message-field'>
									<div className='message-text'>{message.text}</div>
									{message.links.length > 0 && (
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
				<FormCheck
					type='checkbox'
					className='checkbox-field'
					label='Query for Documents'
					checked={queryDocuments}
					onChange={(e) => setQueryDocuments(e.target.checked)}
				/>
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
