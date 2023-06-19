import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { PineconeClient } from "@pinecone-database/pinecone";
import { Client } from '@microsoft/microsoft-graph-client';
import PDFParser from 'pdf2json';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

/** PINECONE SETUP */
const pinecone = new PineconeClient();
await pinecone.init({
  environment: process.env.env_pinecone,
  apiKey: process.env.key_pinecone,
});
const vdb = pinecone.Index(process.env.idx_pinecone);


const app = express();
app.use(cors());

app.use(express.json());

app.post('/api/cross', async (req, res) => {
  const { url } = req.body;
  console.log(`recieved request (${url})...\n`)
  
  try {
    const response = await axios(req.body);
    console.log("response.data:")
    console.log(response)
    res.send(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
  }
});

app.post('/api/pinecone/query', async (req, res) => {
  const { queryRequest  } = req.body;
  console.log(`recieved pinecone request...`)
  
  try {
    const response = await vdb.query({ queryRequest })
    console.log("response:")
    console.log(response)
    res.send(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
  }
});

app.post('/api/sharepoint/getDocumentContent', async (req, res) => {
  const {authToken, documentId} = req.body
  console.log(`recieved sharepoint request for document (${documentId})...`)
  let client = Client.init({
    authProvider: (done) => {
        done(null, authToken);
    },
    fetchOptions: {
        fetch: fetch,
    },
  });
  try {
    const fileUrl = `/me/drive/items/${documentId}`;
    const driveItem = await client.api(fileUrl).get();
    const driveItemContent = await fetch(driveItem['@microsoft.graph.downloadUrl']);

    const pdfBuffer = await driveItemContent.arrayBuffer();
    const pdfParser = new PDFParser(this, 1);

    pdfParser.on("pdfParser_dataError", errData => {
        console.error(errData.parserError);
        res.status(500).send(errData.parserError);
    });

    pdfParser.on("pdfParser_dataReady", pdfData => {
      console.log("pdfData:")
      console.log(pdfData)
      const text = pdfData.Pages.reduce((acc, page) => {
        return acc + page.Texts.reduce((acc2, textItem) => {
          return acc2 + decodeURIComponent(textItem.R[0].T);
        }, '');
      }, '');

      res.send(text);
    });

    pdfParser.parseBuffer(pdfBuffer);

  } catch (err) {
      res.send('Error downloading file');
      console.error(err);
      console.log("\n\n")
  }
})




const port = process.env.PORT || 5000
app.listen(port, () => console.log(`Server running on port ${port}`));
