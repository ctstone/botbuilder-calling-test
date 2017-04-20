# Installation
```
npm install --save botbuilder-calling-test
```

# Usage

## Capture testable events from your bot

```TypeScript
import { BotCallRecorder } from 'botbuilder-calling-test';
import { UniversalCallBot } from 'botbuilder-calling';

// your call bot
const bot = new UniversalCallBot(/* params */);

// store audio and events at 'logs'
const recorder = new BotCallRecorder({rootDir:'logs'});

// use recorder with your bot
bot.use(recorder);

/** run your bot to capture a testable scenario **/
```


## Write tests
```TypeScript
import { MockCallConnector } from 'botbuilder-calling-test';

// use nock or other utility to mock responses from Bing Speech and LUIS, if necessary

// read events from captured data
const mockCallConnector = new MockCallConnector({rootDir:'logs'});

mockCallConnector.requestFromFiles([
  'request1.json',
  'request2.json',
], (err, [
  workflow1,
  workflow2,
]) => {
  expect(workflow1.actions[0].action).toBe('answer');
  expect(workflow2.actions[0].playPrompt.prompts[0].value).toBe('some prompt');
});
```
