
export interface ICreateSchedule {
    startDateTime: Date;
    endDateTime: Date;
    totalSlots: number;
    availableSlots: number;
    meetingLink: string;
    doctorId: string;
}

export interface IUpdateSchedule {
    startDateTime?: Date;
    endDateTime?: Date;
    meetingLink?: string;
}