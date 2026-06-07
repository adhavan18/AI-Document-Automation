import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';

const client = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Extracts plain text from a document buffer using AWS Textract.
 * @param {Buffer} buffer - PDF or image bytes
 * @returns {Promise<string>} - extracted text lines joined by newline
 */
export async function extractTextWithTextract(buffer) {
  const command = new DetectDocumentTextCommand({
    Document: { Bytes: buffer },
  });

  const response = await client.send(command);

  const lines = (response.Blocks || [])
    .filter((b) => b.BlockType === 'LINE' && b.Text)
    .map((b) => b.Text);

  return lines.join('\n');
}
