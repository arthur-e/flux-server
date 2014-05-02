for i in {1..3}; do
    curl -s -w "%{time_total}\n" -o /dev/null $1;
done
