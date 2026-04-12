type Operator = "+" | "-" | "*" | "/" | "%" | "u-";
type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: Operator }
  | { type: "lparen" }
  | { type: "rparen" };

const OPERATOR_PRECEDENCE: Record<Operator, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2,
  "u-": 3,
};

const RIGHT_ASSOCIATIVE = new Set<Operator>(["u-"]);

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    if (/[+\-*/%]/.test(char)) {
      tokens.push({ type: "operator", value: char as Operator });
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let value = "";
      let dotCount = 0;

      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        if (expression[i] === ".") {
          dotCount += 1;
        }
        value += expression[i];
        i += 1;
      }

      if (dotCount > 1 || value === ".") {
        throw new Error("Invalid number format");
      }

      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error("Invalid number");
      }

      tokens.push({ type: "number", value: parsed });
      continue;
    }

    throw new Error(`Unsupported character: "${char}"`);
  }

  return tokens;
}

function toRpn(tokens: Token[]): Array<{ type: "number"; value: number } | { type: "operator"; value: Operator }> {
  const output: Array<{ type: "number"; value: number } | { type: "operator"; value: Operator }> = [];
  const operators: Array<{ type: "operator"; value: Operator } | { type: "lparen" }> = [];

  let previousType: "start" | "number" | "operator" | "lparen" | "rparen" = "start";

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
      previousType = "number";
      continue;
    }

    if (token.type === "lparen") {
      operators.push(token);
      previousType = "lparen";
      continue;
    }

    if (token.type === "rparen") {
      while (operators.length > 0 && operators[operators.length - 1].type !== "lparen") {
        output.push(operators.pop() as { type: "operator"; value: Operator });
      }

      if (operators.length === 0 || operators[operators.length - 1].type !== "lparen") {
        throw new Error("Mismatched parentheses");
      }

      operators.pop();
      previousType = "rparen";
      continue;
    }

    let op = token.value;
    if (
      op === "-" &&
      (previousType === "start" || previousType === "operator" || previousType === "lparen")
    ) {
      op = "u-";
    }

    while (operators.length > 0) {
      const top = operators[operators.length - 1];
      if (top.type !== "operator") {
        break;
      }

      const shouldPop = RIGHT_ASSOCIATIVE.has(op)
        ? OPERATOR_PRECEDENCE[op] < OPERATOR_PRECEDENCE[top.value]
        : OPERATOR_PRECEDENCE[op] <= OPERATOR_PRECEDENCE[top.value];

      if (!shouldPop) {
        break;
      }

      output.push(operators.pop() as { type: "operator"; value: Operator });
    }

    operators.push({ type: "operator", value: op });
    previousType = "operator";
  }

  while (operators.length > 0) {
    const op = operators.pop();
    if (!op || op.type !== "operator") {
      throw new Error("Mismatched parentheses");
    }
    output.push(op);
  }

  return output;
}

function evaluateRpn(
  rpn: Array<{ type: "number"; value: number } | { type: "operator"; value: Operator }>
): number {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === "number") {
      stack.push(token.value);
      continue;
    }

    if (token.value === "u-") {
      const value = stack.pop();
      if (value === undefined) {
        throw new Error("Invalid expression");
      }
      stack.push(-value);
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();

    if (left === undefined || right === undefined) {
      throw new Error("Invalid expression");
    }

    let result: number;
    switch (token.value) {
      case "+":
        result = left + right;
        break;
      case "-":
        result = left - right;
        break;
      case "*":
        result = left * right;
        break;
      case "/":
        if (right === 0) {
          throw new Error("Division by zero");
        }
        result = left / right;
        break;
      case "%":
        if (right === 0) {
          throw new Error("Division by zero");
        }
        result = left % right;
        break;
      default:
        throw new Error("Unsupported operator");
    }

    if (!Number.isFinite(result)) {
      throw new Error("Invalid math result");
    }

    stack.push(result);
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression");
  }

  return stack[0];
}

export function evaluateMathExpression(expression: string): number {
  if (typeof expression !== "string" || expression.trim().length === 0) {
    throw new Error("Expression is required");
  }

  if (expression.length > 200) {
    throw new Error("Expression is too long");
  }

  const tokens = tokenize(expression);
  const rpn = toRpn(tokens);
  return evaluateRpn(rpn);
}
