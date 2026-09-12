import { AppointmentStatus } from "../../../generated/prisma/enums"

export interface IBookAppoinmentPayload {
    scheduleId: string
}
export interface IPayAppoinmentPayload {
    appointmentId: string
}
export interface ICancleAppoinmentPayload {
    appointmentId: string
}

export interface IUpdateAppoinmentStatusPayload {
    status: "ONGOING" | "COMPLETED";
}