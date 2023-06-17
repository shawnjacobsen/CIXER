import React, { useState } from 'react';
import { Button, Form, Container, Row, Col, Navbar } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';

interface Link {
	name:string
	href:string
}
interface Message {
	text:string
	user: "User" | "Bot"
	links: Array<Link>
}

const ChatBox = () => {
	const [messages, setMessages] = useState<Array<Message>>([]);
	const [input, setInput] = useState('');

	/** MESSAGE HANDLING */
	const handleSubmit = (event) => {
		event.preventDefault();

		const userMessage:Message = {
			text: input,
			user: 'User',
			links: []
		};
		setMessages([...messages, userMessage]);

		// TODO
		// const response, links = getInformedResponse()

		const botMessage:Message = {
			text: "",
			user: 'Bot',
			links: []
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
