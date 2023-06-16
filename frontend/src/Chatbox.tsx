import React, { useState, useEffect } from 'react';
import { Button, Form, Card, ListGroup, Container, Row, Col, Navbar } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';

const BOT_RESPONSES = [
	'Hello there!',
	'How can I assist you?',
	'Nice to meet you.',
	"Let's talk about something.",
	"What's your favorite book?",
	'Tell me more.',
	"That's interesting!",
	"I'm glad to hear that.",
	'Could you elaborate?',
	'Have a great day!'
];

const BOT_LINKS = [
  ['Link 1',  'https://www.google.com'],
  ['Link 2',  'https://www.google.com'], 
  ['Link 3',  'https://www.google.com'], 
  ['Link 4',  'https://www.google.com'], 
  ['Link 5',  'https://www.google.com'], 
  ['Link 6',  'https://www.google.com'], 
  ['Link 7',  'https://www.google.com'], 
  ['Link 8',  'https://www.google.com'], 
  ['Link 9',  'https://www.google.com'], 
  ['Link 10', 'https://www.google.com']
];

const ChatBox = () => {
	const [messages, setMessages] = useState<any>([]);
	const [input, setInput] = useState('');

	/** MESSAGE HANDLING */
	const handleSubmit = (event) => {
		event.preventDefault();

		const userMessage = {
			text: input,
			user: 'User',
			links: []
		};
		setMessages([...messages, userMessage]);

		// TODO
		const response, links = getInformedResponse()

		const botMessage = {
			text: BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)],
			user: 'Bot',
			links: randomLinks
		};
		setMessages((prev) => [...prev, botMessage]);

		setInput('');
	};

	return (
		<Container className="app-container">
      <Navbar expand="lg" variant="dark" className="app-navbar">
        <Navbar.Brand href="#">
          <FontAwesomeIcon icon={faCommentDots} /> ChairGPT
        </Navbar.Brand>
      </Navbar>
			<div className="messages-container">
				{messages.map((message, index) => (
          <div className={"card " + (message.user === 'User' ? 'user-card' : 'bot-card')}>
            <Row key={index}>
              <Col xs={2}>
                <strong>{message.user === 'User' ? 'User:' : 'ChairGPT:'}</strong>
              </Col>
              <Col xs={10}>
                <div className="message-field">
                  <div className='message-text'>
                    {message.text}
                  </div>
                  <div className='message-links'>
                    {message.links.map((link, i) => (
                      <span className='chat-link'><a  key={i} href={link[1]}>{link[0]}</a></span>
                    ))}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
				))}
			</div>
			<Form onSubmit={handleSubmit} className="input-form">
				<Form.Group className='input-field'>
					<Form.Control
						type='text'
						placeholder='Enter message'
						value={input}
						onChange={(e) => setInput(e.target.value)}
					/>
				</Form.Group>
				<Button variant='secondary' type='submit'>
					Send
				</Button>
			</Form>
		</Container>
	);
};

export default ChatBox;
