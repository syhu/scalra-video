#!/bin/bash

echo "HTTPPort 8000" > ffserver.conf
echo "RTSPPort 8001" >> ffserver.conf
echo "HTTPBindAddress localhost" >> ffserver.conf
echo "RTSPBindAddress localhost" >> ffserver.conf
echo "MaxClients 100" >> ffserver.conf
echo "MaxBandwidth 10000" >> ffserver.conf
echo "NoDefaults" >> ffserver.conf

for i in `seq 1 50`;
do
echo "" >> ffserver.conf
echo "<Feed dvr_$i.ffm>" >> ffserver.conf
echo "  File /tmp/dvr_$i.ffm" >> ffserver.conf
echo "  FileMaxSize 20M" >> ffserver.conf
echo "</Feed>" >> ffserver.conf
echo "" >> ffserver.conf
echo "<Stream dvr_$i.mp4>" >> ffserver.conf
echo "  Feed dvr_$i.ffm" >> ffserver.conf
echo "  Format rtp" >> ffserver.conf
echo "  VideoSize 640x480" >> ffserver.conf
echo "  VideoQMin 1" >> ffserver.conf
echo "  VideoQMax 20" >> ffserver.conf
echo "  VideoFrameRate 30" >> ffserver.conf
echo "  VideoBitRate 500" >> ffserver.conf
echo "  AVOptionVideo flags +global_header" >> ffserver.conf
echo "  VideoCodec libx264" >> ffserver.conf
echo "  NoAudio" >> ffserver.conf
echo "</Stream>" >> ffserver.conf
echo "" >> ffserver.conf
done

