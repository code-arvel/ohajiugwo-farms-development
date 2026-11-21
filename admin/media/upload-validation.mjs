export function uploadValidationError(file){
 if(!file)return'Choose a photograph before uploading.';
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return'Choose a JPEG, PNG or WebP photograph.';
 if(!Number.isFinite(file.size)||file.size<12)return'This photograph is empty or incomplete. Choose another file.';
 if(file.size>10_485_760)return'Choose a photograph no larger than 10 MB.';
 return'';
}
