#!/bin/bash
# usage: sheet.sh <video> <start seconds> <duration> <frames per second> <columns> <output png> [thumb width]
# A contact sheet with the picture time stamped on every frame.
v=$1; s=$2; d=$3; fps=$4; cols=$5; out=$6; w=${7:-284}
n=$(python3 -c "import math; print(math.ceil($d*$fps))")
rows=$(python3 -c "import math; print(math.ceil($n/$cols))")
ffmpeg -hide_banner -loglevel error -y -ss $s -t $d -i "$v" -vf "fps=$fps,scale=$w:-2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='%{eif\:($s+t)\:d}.%{eif\:mod(($s+t)*100\,100)\:d\:2}':x=4:y=4:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=3,tile=${cols}x${rows}:padding=2:color=black" -frames:v 1 "$out"
