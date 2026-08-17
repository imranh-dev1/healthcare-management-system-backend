import {v2 as Cloudinary} from "cloudinary"
import config from "../config"

Cloudinary.config({
    cloud_name: config.cloudinary_name,
    api_key: config.cloudinary_api_key,
    api_secret: config.cloudinary_secret,

})

export const cloudinary = Cloudinary;