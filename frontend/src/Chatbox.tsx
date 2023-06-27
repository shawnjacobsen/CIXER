import React, { useState, useEffect, useRef } from 'react';
import { ChatCompletionRequestMessageFunctionCall } from 'openai';
import { Button, Form, Container, Row, Col, Navbar, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { cleanStringToAscii, sleep } from './helpers';
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
	const [chatMessages, setChatMessages] = useState<Array<Message>>([
		{
			role: 'system',
			content:
				'You are a helpful assistant named chairGPT. Your goal is to provide accurate and work-appropriate information to employees using company internal documents.'
		},
		{
			content: "please describe lululemon's stance on Gifts and Business Entertainment",
			role: 'user'
		},
		{
			role: 'assistant',
			content: null,
			function_call: {
				name: 'retrieveAccessibleSimilarInformation',
				arguments:
					'{\n  "message": "Lululemon\'s stance on gifts and business entertainment",\n  "minNumDocuments": 1\n}'
			}
		},
		{
			role: 'function',
			name: 'retrieveAccessibleSimilarInformation',
			content:
				'allow vendors or other individuals or organizations to offer bribes or kickbacks on our behalf. A bribe can include giving or receiving any item of value (e.g., money/cash, cash equivalents such as gift cards, gratuities, gifts, kickbacks, unauthorized rebates, meals, entertainment, products, trips, favors, loans, contributions or donations) to/from a person or entity to improperly influence any act or decision to obtain or retain business or to secure any advantage for lululemon, or otherwise improperly promote our business interests in any respect. We have zero tolerance for corruption, and we must always operate with integrity regardless of local custom or industry practice.  Doing business the right way not only helps us obey the law, but it also strengthens our relationships with local communities and our partners. Please refer to our anti-bribery policy on our company intranet site for more information.Import-Export and Trade Laws We transfer products, supplies, and raw -- bribe.FAQ: Could it still be a violation of the Code to give gifts when they are local custom and expected a part of doing business?Yes. Our policies regarding gifts and enter-tainment set out in the Code apply equally in all countries regardless of any perceived local customs/ practice.Insider Trading LawsWe may not buy or sell shares of lululemon stock (or securities of other companies) if we know of material information that has not been made public. Material information is any information 01. We comply with all laws, and in doing so we contribute to healthy communities.lululemon 2021Global Code of Business Conduct and Ethics004that would influence a reasonable investor’s de-cision to buy or sell stock.  Examples of “material information” include consolidated sales figures, the departure of an executive, or a significant issue with a key supplier. Trading in shares while in possession of non-public material information is a serious violation of securities law as is pro-viding -- '
		},
		{
			role: 'assistant',
			content:
				"Lululemon has a strict stance on gifts and business entertainment. They do not allow vendors or individuals to offer bribes or kickbacks on their behalf. This includes giving or receiving any item of value, such as money, gifts, meals, entertainment, or favors, to improperly influence any decision or obtain business advantages for lululemon. Lululemon has zero tolerance for corruption and expects employees to operate with integrity, regardless of local customs or industry practices.\n\nIt is important to note that giving gifts when they are considered local custom or expected as part of doing business is still considered a violation of Lululemon's Code of Business Conduct. Their policies regarding gifts and entertainment apply equally in all countries, regardless of perceived local customs.\n\nFurthermore, Lululemon employees are prohibited from buying or selling shares of lululemon stock (or securities of other companies) if they have access to material information that has not been made public. Trading in shares based on non-public material information is a serious violation of securities law.\n\nFor more detailed information, please refer to Lululemon's anti-bribery policy on their company intranet site.",
			links: [
				{
					name: 'code-of-conduct-november-2021-english.pdf',
					href: 'https://trystoryline-my.sharepoint.com/personal/sjacobsen_trystoryline_onmicrosoft_com/Documents/code-of-conduct-november-2021-english.pdf'
				}
			]
		}
	]);
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
	// useEffect(() => {
	// 	const initSystemPrompt = async () => {
	// 		const systemPrompt = await getSystemPrompt()
	// 		setChatMessages([ { role:'system', content: systemPrompt } ])
	// 	}
	// 	initSystemPrompt()
	// },[])

	// logging messages (DEVELOPMENT)
	useEffect(() => {
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
		await sleep(2000);
		// Pass the new chatMessage array to getResponse
		// const newMessages: Array<Message> = await getResponse(updatedMessages, authToken, openai);
		const newMessages: Array<Message> = [
			...updatedMessages,
			{
				role: 'assistant',
				content: 'DEVELOPMENT DEFAULT RESPONSE',
				links: [
					{
						name: 'code-of-conduct-november-2021-english.pdf',
						href: 'https://trystoryline-my.sharepoint.com/personal/sjacobsen_trystoryline_onmicrosoft_com/Documents/code-of-conduct-november-2021-english.pdf'
					}
				]
			}
		];
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
