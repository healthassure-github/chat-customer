# @ha/chat-customer

Standalone customer chat package with bundled UI primitives and styles.

Included internally:
- `Card`
- `Badge`
- `Spacer`
- `ThemeToggleCompact`
- `ToastProvider`
- attachment + voice-note components

## Usage

```jsx
import { CustomerChat } from "@ha/chat-customer";
import "@ha/chat-customer/styles.css";

export default function ChatPage() {
  return (
    <CustomerChat
      apiBaseUrl="https://asia-south1-your-project.cloudfunctions.net/api"
      firebaseConfig={{
        apiKey: "...",
        authDomain: "...",
        projectId: "...",
        storageBucket: "...",
        messagingSenderId: "...",
        appId: "...",
        databaseURL: "...",
        firestoreDatabase: "(default)"
      }}
      appointmentId=""
      conversationId=""
      customerId=""
      onConversationIdChange={(id) => {
        console.log("conversation changed:", id);
      }}
    />
  );
}
```

`appointmentId` behavior:
- empty => support chat
- set => doctor/appointment chat

## Build

```bash
npm run build
```

Outputs:
- `dist/index.js`
- `dist/index.cjs`
- `dist/styles.css`

## Local tarball install

From this package directory:

```bash
npm run pack:local
```

In consumer project:

```bash
npm i /absolute/path/to/ha-chat-customer-0.1.0.tgz
```

## Install from GitHub

```bash
npm i github:healthassure-github/chat-customer#main
```
