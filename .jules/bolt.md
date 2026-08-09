## 2023-08-09 - [React Memoization Gotcha]
**Learning:** When trying to memoize components rendered in a list using React.memo, simply passing an inline arrow function as an event handler (e.g. `onClick={() => handleSelect(item)}`) breaks memoization because a new function reference is created on every render.
**Action:** Pass stable callback functions directly and update the child component's props to accept identifying values (like `item` or `index`) so that the child can call the stable handler with its identity.
