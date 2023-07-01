import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { PineconeClient } from '@pinecone-database/pinecone';
import { Client } from '@microsoft/microsoft-graph-client';
import PDFParser from 'pdf2json';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

/** PINECONE SETUP */
const pinecone = new PineconeClient();
await pinecone.init({
	environment: process.env.ENV_PINECONE,
	apiKey: process.env.KEY_PINECONE
});
const vdb = pinecone.Index(process.env.IDX_PINECONE);

const app = express();
app.use(cors());

app.use(express.json());

app.post('/api/cross', async (req, res) => {
	const { url } = req.body;
	console.log(`recieved request (${url})...\n`);

	try {
		const response = await axios(req.body);
		res.send(response.data);
	} catch (error) {
		console.error(error);
    if (error.response && error.response.status) {
      // Send status code from error response
      res.status(error.response.status).send(error);
    } else {
      // If no status code from error, send 500 as default
      res.status(500).send(error);
    }
	}
});

app.post('/api/pinecone/query', async (req, res) => {
	const { queryRequest } = req.body;
	console.log(`recieved pinecone request...`);

	try {
		const response = await vdb.query({ queryRequest });
		res.send(response);
	} catch (error) {
		console.error(error);
    if (error.response && error.response.status) {
      // Send status code from error response
      res.status(error.response.status).send(error);
    } else {
      // If no status code from error, send 500 as default
      res.status(500).send(error);
    }
	}
});

app.post('/api/sharepoint/getDocumentContent', async (req, res) => {
	const { authToken, driveId, documentId } = req.body;
	console.log(`recieved sharepoint request for document...\ndrive: ${driveId}\ndocument: ${documentId})\n`);
	let client = Client.init({
		authProvider: (done) => {
			done(null, authToken);
		},
		fetchOptions: {
			fetch: fetch
		}
	});
	try {
		const fileUrl = `/drives/${driveId}/items/${documentId}`;
		const driveItem = await client.api(fileUrl).get();
		const driveItemContent = await fetch(driveItem['@microsoft.graph.downloadUrl']);

		// Get the file extension
		const fileExtension = driveItem.name.split('.').pop().toLowerCase();
		
		if (fileExtension === 'pdf') {
			const pdfBuffer = await driveItemContent.arrayBuffer();
			const pdfParser = new PDFParser(this, 1);
	
			pdfParser.on('pdfParser_dataError', (errData) => {
				console.error(errData.parserError);
				res.status(500).send(errData.parserError);
			});
	
			pdfParser.on('pdfParser_dataReady', (pdfData) => {
				const text = pdfData.Pages.reduce((acc, page) => {
					return (
						acc +
						page.Texts.reduce((acc2, textItem) => {
							return acc2 + decodeURIComponent(textItem.R[0].T);
						}, '')
					);
				}, '');
	
				res.send(text);
			});
	
			pdfParser.parseBuffer(pdfBuffer);
		} else {
			// assume file is plain text
			const textBuffer = await driveItemContent.text();
			res.send(textBuffer);
		}
	} catch (error) {
		console.error(error);
    if (error.response && error.response.status) {
      // Send status code from error response
      res.status(error.response.status).send(error);
    } else {
      // If no status code from error, send 500 as default
      res.status(500).send(error);
    }
	}
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
