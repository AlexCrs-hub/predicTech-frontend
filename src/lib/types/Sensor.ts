interface Reading {
    measurement: number;
    measuredAt: Date;
}

export interface Sensor {
    _id: string;
    name: string;
    readings: Reading[];
}