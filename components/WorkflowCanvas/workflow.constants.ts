import { type Edge, type Node } from "@xyflow/react";

export type PaymentInitData = { amount: number };
export type PaymentCountryData = {
  currency: string;
  country: string;
  countryCode: string;
};
export type PaymentProviderData = { name: string; code: string };

export type PaymentInitNodeType = Node<PaymentInitData, "paymentInit">;
export type PaymentCountryNodeType = Node<PaymentCountryData, "paymentCountry">;
export type PaymentProviderNodeType = Node<
  PaymentProviderData,
  "paymentProvider"
>;

export type WorkflowNode =
  | PaymentInitNodeType
  | PaymentCountryNodeType
  | PaymentProviderNodeType;

export type WorkflowEdge = Edge;

export const initialNodes: WorkflowNode[] = [
  {
    id: "1",
    position: { x: 100, y: 100 },
    data: { amount: 10 },
    type: "paymentInit",
  },
  {
    id: "2",
    position: { x: 320, y: 20 },
    data: {
      currency: "$",
      country: "United States",
      countryCode: "US",
    },
    type: "paymentCountry",
  },
  {
    id: "3",
    position: { x: 320, y: 220 },
    data: {
      currency: "£",
      country: "England",
      countryCode: "GB",
    },
    type: "paymentCountry",
  },
  {
    id: "4",
    position: { x: 600, y: -40 },
    data: { name: "Google Pay", code: "Gp" },
    type: "paymentProvider",
  },
  {
    id: "5",
    position: { x: 600, y: 120 },
    data: { name: "Stripe", code: "St" },
    type: "paymentProvider",
  },
  {
    id: "6",
    position: { x: 600, y: 320 },
    data: { name: "Apple Pay", code: "Ap" },
    type: "paymentProvider",
  },
];

export const initialEdges: WorkflowEdge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    type: "customEdge",
    animated: true,
  },
  {
    id: "e1-3",
    source: "1",
    target: "3",
    type: "customEdge",
    animated: true,
  },
  {
    id: "e2-4",
    source: "2",
    target: "4",
    type: "customEdge",
    animated: true,
  },
  {
    id: "e3-5",
    source: "3",
    target: "5",
    type: "customEdge",
    animated: true,
  },
];
