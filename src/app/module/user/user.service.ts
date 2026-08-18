import { UploadApiResponse } from "cloudinary"
import { cloudinary } from "../../lib/cloudinary"
import { prisma } from "../../lib/prisma"

const profileImageUpload = async (buffer: Buffer, userId: string)=> {
    
    const cloudinaryResult = await new Promise<UploadApiResponse> ((resolve, reject)=>{
        cloudinary.uploader.upload_stream({resource_type: "auto"}, 
            async (error, result)=> {
                if (error) {
                    return reject(error)
                } 

                if (!result) {
                    return reject(new Error("No Result form Cloudanry"))
                }

                resolve(result) 
            }
        ).end(buffer)
    })

    const updateUserProfileImage = await prisma.user.update({
        where: {
            id: userId
        },
        data: {
            imagePublicId:  cloudinaryResult?.public_id,
            imageUrl: cloudinaryResult?.secure_url
        },
        omit: {
            password: true
        }
    }) 
    return updateUserProfileImage; 
}


export const UserServices = {
    profileImageUpload
}