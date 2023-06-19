import React, { useState, useEffect } from 'react';
import { Button, Form, Container, Row, Col, Navbar } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCommentDots } from '@fortawesome/free-solid-svg-icons'
import { Bot } from './bot';
export interface Link {
	name:string
	href:string
}
export interface Message {
	text:string
	user: "User" | "Bot"
	links: Array<Link>
}

const ChatBox:React.FC<{authToken:string}> = ({authToken}) => {
	const [messages, setMessages] = useState<Array<Message>>([]);
	const [bot] = useState<Bot>(new Bot())
	const [input, setInput] = useState('');

	/** MESSAGE HANDLING */
	const handleSubmit = async (event) => {
		event.preventDefault();

		const userMessage:Message = {
			text: input,
			user: 'User',
			links: []
		};
		setMessages([...messages, userMessage]);

		const botMessage:Message = await bot.getResponse(userMessage, authToken)
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
          <div key={index} className={"card " + (message.user === 'User' ? 'user-card' : 'bot-card')}>
            <Row>
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
