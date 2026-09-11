
//image for question 

convert 'akinator_bg.jpg' 'aki2.png' -gravity west -fill '#FFFFFF' -font 'Santuy.otf' -size 1280x720 -pointsize 48 -annotate +475-235 'Apakah dia seorang perempuan?' -gravity center -composite 'output2.jpg'


//image for finish game                        
                        
convert akinator_bg_finish.jpg \( result.jpg -resize 300x485 \) -gravity center -geometry +200+20 -composite -font Santuy.otf -pointsize 45 -fill white -annotate +200-255 'TEKS_YANG_INGIN_DITAMBAHKAN' aki7.png -gravity center -composite output.jpg


convert './src/asset/akinator_bg_finish.jpg' \( './jawaban_aki_${m.sender}.jpg' -resize 300x485 \) -gravity center -geometry +200+20 -composite -font './src/asset/Santuy.otf' -pointsize 45 -fill white -annotate +200-255 '${akinator[m.sender].guess.name_proposition}' './src/asset/aki7.png' -gravity center -composite './akinator_${m.sender}_end.jpg'

convert './src/asset/akinator_bg_finish.jpg' \( './jawaban_aki_6285849261085@s.whatsapp.net.jpg' -resize 300x485 \) -gravity center -geometry +200+20 -composite -font './src/asset/Santuy.otf' -pointsize 45 -fill white -annotate +200-255 'kontol' './src/asset/aki7.png' -gravity center -composite './akinator_6285849261085@s.whatsapp.net_end.jpg'
                        