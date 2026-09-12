export interface IMedicine {
    name: string,
    dosage: string,
    duration: string,
    instructions?: string
}

export interface ICreatePrescriptionPayload {
    appointmentId: string,
    finding: string,
    medicines: IMedicine[]
}