# Journalist's Alpha Copilot

An AI agent that helps financial journalists discover actionable market signals through a simple chat-based interface. Built for the ET AI Hackathon 2026.

## Setup Instructions

1. Create a Firebase project, enable Firestore, and generate a service account private key.
2. Base64-encode the JSON key file: `base64 -i service-account.json -o service-account.b64`
3. Copy the contents of the `.b64` file into the Vercel environment variable `FIRESTORE_CREDENTIALS`.
4. Add `GOOGLE_API_KEY` from Google AI Studio to your environment variables.
5. Deploy to Vercel using `vercel --prod`.

## Architecture

- **Backend**: Serverless Python (Vercel) using raw ASGI.
- **LLM**: Google Gemini 1.5 Pro with function calling.
- **Database**: Firestore for state management and audit trails.
- **Frontend**: Static HTML/JS with Tailwind CSS.

## Audit Trail

Every interaction, including the journalist's query, the sequence of function calls made by Gemini, the latency, and the final output, is logged to the `audit_logs` collection in Firestore for compliance and transparency.
