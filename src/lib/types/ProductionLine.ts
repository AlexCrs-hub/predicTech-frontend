import { Machine } from "../components/machineList/types";

export interface ProductionLine {
    _id: string;
    name: string;
    machines: Machine[];
}